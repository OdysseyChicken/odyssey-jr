// Life around my big oak (Day 3, bonus 6). Shared by the blue jay, the squirrel, the owl and my trail camera.
// Not a behavior by itself: the others import it, so they all share one pile of acorns and one list of critters.
//  - acorns: the oak drops one every so often; critters pick them up and hide them ("cache" them) around the yard.
//  - critters: each animal registers itself so OJ Cam 1 knows who it is when it snaps a photo.
//  - sound: one little WebAudio helper (sounds only start after a visitor clicks somewhere, like everything in my yard).
//  - perchOn: finds the top of a thing (or a spot on the oak's leaves) by dropping a ray from the sky.
import { daylight } from "../world/sky.js";

export const critters = [];   // { id, name, kind, obj, visible() }
export const stats = { cached: 0, eaten: 0, fakes: 0, hoots: 0, mimics: 0 };
export const dayness = () => daylight(new Date());

// ---------- sound ----------
let ac = null;
addEventListener("pointerdown", () => { try { ac ??= new (window.AudioContext || window.webkitAudioContext)(); ac.resume?.(); } catch { } }, { capture: true });
export function audio() { return ac && ac.state === "running" ? ac : null; }
// a quick tone sweep: freq from a to b over secs, through a bandpass "throat"
export function chirp({ a, b, secs = 0.2, at = 0, vol = 0.12, type = "sawtooth", q = 3, band = 2000, pan = 0 }) {
  const c = audio(); if (!c) return;
  const t = c.currentTime + at, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(a, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, b), t + secs);
  f.type = "bandpass"; f.frequency.value = band; f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, secs * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + secs);
  o.connect(f); f.connect(g);
  if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(c.destination); } else g.connect(c.destination);
  o.start(t); o.stop(t + secs + 0.05);
}
// left/right from where the visitor is looking
export function panFor(camera, pos) {
  const r = { x: Math.cos(camera.rotation.y), z: -Math.sin(camera.rotation.y) };
  const dx = pos.x - camera.position.x, dz = pos.z - camera.position.z, d = Math.hypot(dx, dz) || 1;
  return (dx * r.x + dz * r.z) / d * 0.8;
}
export const volFor = (camera, pos, base) => base / (1 + camera.position.distanceTo(pos) / 12);

// ---------- perches ----------
let ray = null;
export function perchOn(THREE, obj, dx = 0, dz = 0) {
  if (!obj || !obj.children.length) return null;
  ray ??= new THREE.Raycaster();
  ray.set(new THREE.Vector3(obj.position.x + dx, 40, obj.position.z + dz), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObject(obj, true)[0];
  return hit ? hit.point.clone() : null;
}

// ---------- acorns ----------
let pile = null;
export function acorns(THREE, scene, oak) {
  if (pile) return pile;
  const cap = new THREE.MeshStandardMaterial({ color: "#6b4a2a", roughness: 0.9 }), nut = new THREE.MeshStandardMaterial({ color: "#b07a3a", roughness: 0.6 });
  const make = () => {
    const g = new THREE.Group();
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), nut); n.scale.set(1, 1.3, 1); g.add(n);
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), cap); c.position.y = 0.035; g.add(c);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 5), cap); s.position.y = 0.1; g.add(s);
    g.traverse(m => { if (m.isMesh) m.castShadow = true; });
    return g;
  };
  const C = oak.position, list = [];
  let seed = 11; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const spotNear = () => { const a = r() * Math.PI * 2, d = 1.0 + Math.sqrt(r()) * 1.9; return [C.x + Math.cos(a) * d, C.z + Math.sin(a) * d]; };
  const drop = (fall) => {
    const [x, z] = spotNear(), a = make(); a.position.set(x, fall ? 4.5 : 0.07, z); a.rotation.set(Math.PI / 2 * (0.6 + r() * 0.5), r() * 6, 0);
    a.userData = { fall: fall ? 1 : 0, vy: 0 }; scene.add(a); list.push(a); return a;
  };
  for (let i = 0; i < 14; i++) drop(false);
  const mounds = [];
  const moundMat = new THREE.MeshStandardMaterial({ color: "#7a5a3a", roughness: 1, transparent: true });
  pile = {
    make, list,
    nearest(x, z) { let best = null, bd = 1e9; for (const a of list) { if (a.userData.fall || a.userData.taken) continue; const d = Math.hypot(a.position.x - x, a.position.z - z); if (d < bd) { bd = d; best = a; } } return best; },
    take(a) { a.userData.taken = true; scene.remove(a); list.splice(list.indexOf(a), 1); },
    mound(x, z) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), moundMat.clone()); m.scale.y = 0.35; m.position.set(x, 0, z); m.userData.life = 40; scene.add(m); mounds.push(m); },
    update(dt) {
      const now = performance.now(); if (now - (pile.last ?? 0) < 4) return; pile.last = now; // several critters call this each frame; run once
      // the oak drops a new acorn every 25-50 seconds (if there aren't plenty already). Plink!
      pile.next = (pile.next ?? 20) - dt;
      if (pile.next <= 0) { pile.next = 25 + Math.random() * 25; if (list.length < 18) { drop(true); } }
      for (const a of list) if (a.userData.fall) {
        a.userData.vy -= 9.8 * dt; a.position.y += a.userData.vy * dt;
        if (a.position.y <= 0.07) { a.position.y = 0.07; a.userData.fall = 0; chirp({ a: 1800, b: 1200, secs: 0.05, vol: 0.05, type: "triangle", band: 1600, q: 1 }); }
      }
      for (let i = mounds.length - 1; i >= 0; i--) { const m = mounds[i]; m.userData.life -= dt; m.material.opacity = Math.min(1, m.userData.life / 8); if (m.userData.life <= 0) { scene.remove(m); mounds.splice(i, 1); } }
    }
  };
  return pile;
}
// a random spot in the yard to hide an acorn (not in the pond, not under the runway)
export function cacheSpot(near, rnd = Math.random) {
  for (let i = 0; i < 20; i++) {
    const x = near.x + (rnd() - 0.5) * 16, z = near.z + (rnd() - 0.5) * 16;
    if (Math.abs(x) > 17 || Math.abs(z) > 17) continue;
    if (Math.hypot(x - 9, z - 7) < 3.2) continue;          // the pond
    if (z < -12 && z > -16) continue;                      // the runway
    return [x, z];
  }
  return [near.x + 2, near.z + 2];
}
// bezier hop/flight helper: from a to b with an arc of height h, t in 0..1
export function arc(out, a, b, h, t) {
  out.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t + Math.sin(Math.PI * t) * h, a.z + (b.z - a.z) * t);
  return out;
}

// ---------- a little speech tag over a critter (like Puddles has) ----------
export function makeTag() {
  const el = document.createElement("div");
  Object.assign(el.style, { position: "fixed", transform: "translate(-50%,-100%)", background: "#fffaf0", border: "2px solid #2b2540", borderRadius: "12px",
    padding: "2px 9px", font: "800 13px Nunito, sans-serif", color: "#2b2540", pointerEvents: "none", opacity: 0, transition: "opacity .3s", zIndex: 5, whiteSpace: "nowrap" });
  document.body.appendChild(el);
  let left = 0; const v = { x: 0, y: 0, z: 0 };
  return {
    speak(txt, secs = 2.5) { el.textContent = txt; left = secs; },
    update(dt, camera, pos, show = true) {
      left -= dt;
      const p = pos.clone().project(camera);
      el.style.left = (p.x * 0.5 + 0.5) * innerWidth + "px"; el.style.top = (-p.y * 0.5 + 0.5) * innerHeight + "px";
      el.style.opacity = left > 0 && show && p.z < 1 ? 1 : 0;
    }
  };
}
window.__ojOak = { critters, stats }; // handy for testing
