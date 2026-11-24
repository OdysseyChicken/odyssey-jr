// OJ Music Box (Day 12): a storybook-big Swiss cylinder music box on a stone plinth.
// - The brass cylinder really carries the pins for all three tunes (world/musicbox.js). Each tune's pins sit a hair to
//   the side of the last one's. After each turn the cylinder slides sideways ("changeante") and the dial moves to the next tune.
// - A pin going past a tooth plucks it: the tooth wobbles and you hear it (after you've clicked once, and only up close).
// - The fly (the fan on the endless screw) whirs while it plays. When the spring runs down, it slows... and stops.
// - In the evening I wind it up myself and listen (the "musicbox" action).
import { TUNES, STEPS, STEP_SEC, TEETH, NAMES, pluck, damp } from "../world/musicbox.js";

let ac = null;
const unlock = () => { try { ac ??= new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); } catch (e) { /* no sound */ } };
addEventListener("pointerdown", unlock);

const PITCH = 0.06, SHIFT = 0.02, R = 0.13; // tooth spacing, sideways shift per tune, cylinder radius (from the Blender model)
const DIAL = [0.7, 0, -0.7];

export default function setup({ THREE, obj, say, sim, camera, chicken, viewRoom, openModal, react, chickenInfo }) {
  let ok = false, cyl, fly, crank, pointer, teeth = [], leads = [];
  const wob = new Array(TEETH).fill(0), ringing = new Array(TEETH).fill(null);
  // the spring: "turns" = how many tunes are left to play. Playing state:
  const P = { on: false, tune: 0, left: 0, phi: 0, lastStep: -1, winding: 0, slow: 1, by: "" };
  let chat = 0;
  const wp = new THREE.Vector3();

  const near = () => {
    if (viewRoom && viewRoom() !== "outside") return 0;
    obj.getWorldPosition(wp); const d = camera.position.distanceTo(wp);
    return Math.max(0, Math.min(1, 1 - (d - 10) / 35));
  };

  function init() {
    cyl = obj.getObjectByName("cylinder"); fly = obj.getObjectByName("fly"); crank = obj.getObjectByName("crank"); pointer = obj.getObjectByName("tune_pointer");
    teeth = []; leads = [];
    for (let i = 0; i < TEETH; i++) { teeth.push(obj.getObjectByName("tooth" + i)); leads.push(obj.getObjectByName("tooth" + i + "_lead")); }
    if (!cyl || teeth.some(t => !t)) return false;
    teeth.forEach(t => t.userData.y0 = t.position.y);
    leads.forEach(l => l && (l.userData.y0 = l.position.y));
    // pins: every tune's pins, all on the same cylinder, like the real thing (tune k is shifted sideways by k * SHIFT)
    const geo = new THREE.CylinderGeometry(0.007, 0.009, 0.028, 6); geo.translate(0, R + 0.012, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xdfe3ea, metalness: 0.4, roughness: 0.35 });
    const all = TUNES.flatMap((t, k) => t.pins.map(([s, i]) => [s, i, k]));
    const pins = new THREE.InstancedMesh(geo, mat, all.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
    const x0 = -(TEETH - 1) * PITCH / 2;
    all.forEach(([s, i, k], n) => {
      const th = (s / STEPS) * Math.PI * 2;
      // a pin at angle th points along (0, sin th, cos th): it reaches the tooth tips (+z, the front) when the cylinder has turned th
      // CylinderGeometry points up (+y): tip it over so th = 0 points at the comb (+z)
      e.set(Math.PI / 2 - th, 0, 0); q.setFromEuler(e); pos.set(x0 + i * PITCH + (k - 1) * SHIFT, 0, 0);
      m.compose(pos, q, one); pins.setMatrixAt(n, m);
    });
    const holder = new THREE.Group(); holder.add(pins); cyl.add(holder);
    shiftTo(0);
    return (ok = true);
  }
  function shiftTo(k) { if (!cyl) return; cyl.userData.x0 ??= cyl.position.x; cyl.userData.target = cyl.userData.x0 - (k - 1) * SHIFT; if (pointer) pointer.userData.target = DIAL[k]; }

  function hit(i, loud) {
    wob[i] = 1;
    if (!ac || loud <= 0.01) return;
    if (ringing[i]) damp(ac, ringing[i]); // the damper touches it first, so no buzz
    ringing[i] = pluck(ac, ac.destination, i, 0.13 * loud);
  }
  function start(tunes, by = "you", from = P.on ? P.tune : 0) {
    P.on = true; P.tune = from; P.left = tunes; P.phi = 0; P.lastStep = -1; P.winding = 2.2; P.slow = 1; P.by = by;
    shiftTo(P.tune);
  }

  function pinChart(k) {
    const t = TUNES[k], W = 560, H = 190, cw = W / STEPS, rh = (H - 20) / TEETH;
    const dots = t.pins.map(([s, i]) => `<circle cx="${(s + 0.5) * cw}" cy="${H - 10 - (i + 0.5) * rh}" r="2.6" fill="#2b2540"/>`).join("");
    const rows = NAMES.map((n, i) => i % 2 ? "" : `<rect x="0" y="${H - 10 - (i + 1) * rh}" width="${W}" height="${rh}" fill="#f4e3b3"/>`).join("");
    return `<svg viewBox="-28 0 ${W + 30} ${H}" style="width:100%;background:#fbf1d4;border-radius:10px;border:2px solid #2b2540">${rows}
      ${NAMES.map((n, i) => i % 3 ? "" : `<text x="-4" y="${H - 10 - (i + 0.2) * rh}" font-size="9" text-anchor="end" fill="#6b5a3a">${n}</text>`).join("")}${dots}</svg>`;
  }
  function panel() {
    const k = P.on ? P.tune : 0;
    openModal("🎶 OJ Music Box", "A Swiss cylinder music box, chicken-sized. 18 steel teeth, one brass cylinder, three tunes.", `
      <p style="font-size:15px;margin:4px 0">${P.on ? `▶️ Playing <b>${TUNES[P.tune].name}</b> right now.` : "It's quiet. Wind it up!"}</p>
      <p style="text-align:center;margin:8px 0"><button class="btn paper pill" id="mbWind">🔑 Wind it up (all 3 tunes)</button></p>
      <p style="text-align:center;margin:6px 0">${TUNES.map((t, j) => `<button class="btn paper pill" data-mbt="${j}" style="margin:2px">${j + 1}. ${t.name}</button>`).join("")}</p>
      <p style="font-size:14px;margin:10px 0 4px"><b>Tune ${k + 1}: ${TUNES[k].name}.</b> ${TUNES[k].about}</p>
      <p style="font-size:13px;margin:2px 0 6px;color:#6b5a3a">This is the cylinder unrolled flat: each dot is a pin, each row a tooth (low notes at the bottom).</p>
      ${pinChart(k)}
      <p style="font-size:15px;margin:12px 0;text-align:center">🧷 <a href="projects/pin-roll/" target="_blank" rel="noopener"><b>Pin your own tune!</b></a> (my Pin Roll workshop)</p>
      <details><summary style="cursor:pointer;font-weight:800">How a music box works (I learned this today)</summary><div style="font-size:13px">
      <p>In <b>1796</b> a clockmaker in Geneva, <b>Antoine Favre</b>, had an idea: instead of a stack of little bells, use a <b>comb</b> of tuned steel teeth. A brass <b>cylinder</b> full of tiny pins turns past it, and every pin plucks one tooth.</p>
      <p><b>Long teeth ring low, short teeth ring high.</b> The bass teeth also get <b>lead weights</b> underneath (look under mine, the gray blobs on the left!), so they ring lower without being enormous. The factory makes each tooth ring, listens, and grinds a tiny bit off until it's exactly in tune.</p>
      <p>A tooth is a bar clamped at one end. Its overtones aren't neat multiples like a guitar string: the next one up is about <b>6.27 times</b> the note. That's the bright "tink". It dies fast and leaves the pure ringing note.</p>
      <p><b>Dampers</b> are tiny wires just behind the tooth tips. A pin nudges the damper to stop the old ringing a moment before it plucks the tooth again. Otherwise: bzzzt.</p>
      <p>The spring would spin everything way too fast, so there's a <b>governor</b>: a worm gear called the <b>endless screw</b> with a little fan on top (the <b>fly</b>, or air brake). Air pushes back harder the faster it spins (4 times harder at double speed!), so it settles at one steady speed. If it breaks, the cylinder runs wild and snaps teeth. That's called a <b>run</b>. Yikes.</p>
      <p>Mine is a <b>changeante</b>: after each turn the cylinder slides sideways by a third of a tooth, and a different row of pins lines up. Three tunes, one cylinder. Real cylinders can have over a thousand pins, put in by hand on a pinning lathe from a plan made by an <b>arranger</b>. Mine has ${TUNES.reduce((a, t) => a + t.pins.length, 0)}.</p>
      <p>Music box teeth can't hold a long note, so arrangers play long notes as fast repeats. My train whistle is made that way.</p></div></details>`);
    setTimeout(() => {
      const w = document.getElementById("mbWind"); if (w) w.onclick = () => { unlock(); start(3, "you", 0); say("Click-click-click-click. Wound! Listen...", 3); panel(); };
      document.querySelectorAll("[data-mbt]").forEach(b => b.onclick = () => { unlock(); start(1, "you", +b.dataset.mbt); say(`Tune ${+b.dataset.mbt + 1}! ${TUNES[+b.dataset.mbt].name}.`, 3); panel(); });
    }, 0);
  }

  function wobble(dt) {
    for (let i = 0; i < TEETH; i++) {
      if (wob[i] <= 0.001) { if (wob[i]) { wob[i] = 0; teeth[i].position.y = teeth[i].userData.y0; if (leads[i]) leads[i].position.y = leads[i].userData.y0; } continue; }
      wob[i] *= Math.exp(-dt * 5);
      const y = Math.sin(performance.now() / 1000 * (60 + i * 4)) * 0.006 * wob[i];
      teeth[i].position.y = teeth[i].userData.y0 + y; if (leads[i]) leads[i].position.y = leads[i].userData.y0 + y;
    }
  }

  return {
    update(dt, t) {
      if (!ok && !init()) return;
      // slide the cylinder and the dial
      cyl.position.x += ((cyl.userData.target ?? cyl.position.x) - cyl.position.x) * Math.min(1, dt * 4);
      if (pointer) pointer.rotation.z += ((pointer.userData.target ?? 0) - pointer.rotation.z) * Math.min(1, dt * 4);
      // me: in the evening I come and wind it, then listen
      const me = chickenInfo?.();
      const mine = sim?.act === "musicbox" && me?.room === "outside" && chicken && Math.hypot(chicken.position.x - obj.position.x, chicken.position.z - obj.position.z) < 3.5;
      if (mine && !P.on && !me.busy) { start(1 + Math.floor(Math.random() * 3), "me", Math.floor(Math.random() * 3)); say("Wind, wind, wind... there.", 2.5); }
      if (P.winding > 0) { P.winding -= dt; if (crank) crank.rotation.x -= dt * 9; return wobble(dt); }
      if (P.on) {
        // the spring runs down at the end of the last tune: the governor can't keep the speed up anymore
        const total = P.left - P.phi / (Math.PI * 2);
        P.slow = total < 0.12 ? Math.max(0.35, total / 0.12) : 1;
        const stepNow = P.phi / (Math.PI * 2) * STEPS;
        P.phi += dt * P.slow * (Math.PI * 2) / (STEPS * STEP_SEC);
        const stepNew = P.phi / (Math.PI * 2) * STEPS;
        if (fly) fly.rotation.y += dt * 30 * P.slow;
        const loud = near();
        for (const [s, i] of TUNES[P.tune].pins) if (s >= stepNow && s < stepNew) hit(i, loud);
        cyl.rotation.x = P.phi;
        if (P.phi >= Math.PI * 2) {
          P.left--; P.phi -= Math.PI * 2;
          if (P.left <= 0) { P.on = false; P.phi = 0; cyl.rotation.x = 0; if (P.by === "me" && mine) say(["Ahh. That's the good stuff.", "Again? No. Well... maybe tomorrow.", "Every pin, every time. Same song. I love that."][Math.floor(Math.random() * 3)], 3); }
          else { P.tune = (P.tune + 1) % TUNES.length; shiftTo(P.tune); P.winding = 0.6; } // the changeante shift: slide, click, next tune
        }
        if (mine && P.on) {
          chat -= dt;
          if (chat <= 0) { chat = 8 + Math.random() * 6; const L = [`This one's "${TUNES[P.tune].name}".`, "Look at the little fan go! That's the fly. It keeps the speed steady.", "Tink tink tink. Every pin is a note.", "The long teeth on the left have lead feet. Heh.", "Shh. Lullaby part."]; say(L[Math.floor(Math.random() * L.length)], 3.5); }
        }
      }
      wobble(dt);
    },
    onClick() { unlock(); panel(); react?.({ act: "musicbox", run: [-5.5, 17.6], text: "listening to his music box", secs: 6, say: "Ooh, wind it up! I'll listen." }); }
  };
}
