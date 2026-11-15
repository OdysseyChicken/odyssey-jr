// Hoo, the great horned owl (Day 3, bonus 6). He only comes at night, when I'm asleep in my coop, so I've never seen him
// myself. My trail camera has. He sits in my big oak, swivels his head around (owls can turn their heads 270 degrees!),
// hoots, and sometimes flies a lap around the yard without making one single sound. November and December are when great
// horned owls hoot the most: it's their courting and "this is MY territory" season. Their hoot: one long, then 3 or 4 short.
import { critters, stats, dayness, chirp, panFor, volFor, perchOn, makeTag } from "./oak-life.js";

export default function setup({ THREE, obj, scene, say, camera, objects, chickenInfo, openModal }) {
  const oak = objects["big-oak"], board = objects["fence-map-board"];
  const tag = makeTag();
  critters.push({ id: "owl", name: "Hoo the great horned owl", kind: "owl", obj, visible: () => obj.visible });
  obj.visible = false;
  let head = null, wings = [], eyeMats = [], gen = null, perch = null, here = false, flying = false, hootIn = 6, lapIn = 120, t = 0, saidTonight = "";
  const tmp = new THREE.Vector3();

  function hoot() {
    const pan = panFor(camera, obj.position), vol = volFor(camera, obj.position, 0.22);
    const notes = [[0, 0.75, 1], [1.0, 0.22, 0.8], [1.3, 0.45, 0.9], [1.95, 0.4, 0.75], [2.5, 0.4, 0.65]];
    for (const [at, secs, v] of notes) { chirp({ a: 300, b: 270, secs, at, vol: vol * v, type: "sine", band: 290, q: 0.6, pan }); chirp({ a: 600, b: 540, secs, at, vol: vol * v * 0.12, type: "triangle", band: 580, q: 1, pan }); }
    tag.speak("Hoooo… hoo-hoo… hoo… hoo", 3.5); stats.hoots++;
    const me = chickenInfo(), night = new Date().toDateString();
    if (me.room !== "outside" && saidTonight !== night && Math.random() < 0.5) { saidTonight = night; say("Zzz… (was that an owl?) …good thing I'm inside my coop… Zzz…", 5); }
  }

  function* pause(secs, fn) { let s = 0; while (s < secs) { const dt = yield; s += dt; fn?.(s, dt); } }
  function* glide(p, h = 1.5) {
    const a = obj.position.clone(), d = a.distanceTo(p), dur = Math.max(0.8, d / 5); flying = true; let s = 0;
    obj.rotation.y = Math.atan2(p.x - a.x, p.z - a.z);
    while (s < dur) { const dt = yield; s += dt; const k = Math.min(1, s / dur); obj.position.lerpVectors(a, p, k); obj.position.y += Math.sin(Math.PI * k) * h; }
    flying = false; obj.position.copy(p);
  }
  // his two favorite perches: the top of my map board (staring at my oak and my coop) and a branch of the oak
  const pickPerch = () => { const p = Math.random() < 0.65 ? perchOn(THREE, board) : perchOn(THREE, oak, 1.75, -1.0); perch = p ?? perch ?? oak.position.clone().add(new THREE.Vector3(1.5, 4, -1)); };
  const faceCoop = () => { obj.rotation.y = Math.atan2(oak.position.x - obj.position.x, oak.position.z - obj.position.z); };
  function* arrive() {
    const a = Math.random() * Math.PI * 2; obj.position.set(Math.cos(a) * 34, 12, Math.sin(a) * 34); obj.visible = true; pickPerch();
    yield* glide(perch, -2); faceCoop(); here = true;
  }
  function* lap() { // a silent lap around the yard: soft fringed feathers break up the swoosh, so owls fly with no sound
    here = false; const c = new THREE.Vector3(0, 5.5, 0), r = 11, a0 = Math.atan2(perch.z, perch.x);
    yield* glide(new THREE.Vector3(Math.cos(a0) * r, 5.5, Math.sin(a0) * r), 0.5);
    let s = 0; flying = true;
    while (s < 9) { const dt = yield; s += dt; const a = a0 + (s / 9) * Math.PI * 2; obj.position.set(c.x + Math.cos(a) * r, c.y + Math.sin(s * 1.3) * 0.5, c.z + Math.sin(a) * r); obj.rotation.y = -a; }
    pickPerch(); yield* glide(perch, 0.8); faceCoop(); here = true;
  }
  function* leave() { here = false; const a = Math.random() * Math.PI * 2; yield* glide(new THREE.Vector3(Math.cos(a) * 34, 12, Math.sin(a) * 34), 2); obj.visible = false; }

  return {
    update(dt, tt) {
      t = tt;
      if (!head && obj.children.length) {
        head = obj.getObjectByName("owl_head"); wings = ["owl_wing_l", "owl_wing_r"].map(n => obj.getObjectByName(n)).filter(Boolean);
        obj.traverse(n => { if (n.isMesh && n.material?.name === "owl_eye") { n.material = n.material.clone(); eyeMats.push(n.material); } });
        if (head) head.userData.turn = 0;
      }
      if (!head || !oak.children.length || !board?.children.length) return;
      if (!perch) pickPerch();
      const dark = dayness() < 0.12;
      if (gen) { if (gen.next(dt).done) gen = null; }
      else if (dark && !obj.visible) gen = arrive();
      else if (!dark && obj.visible) gen = leave();
      else if (here) {
        hootIn -= dt; lapIn -= dt;
        if (hootIn <= 0) { hootIn = 18 + Math.random() * 25; hoot(); }
        if (lapIn <= 0) { lapIn = 120 + Math.random() * 120; gen = lap(); }
        if (Math.random() < dt * 0.25) head.userData.turn = (Math.random() - 0.5) * 4.6; // up to 135° each way = 270° total
      }
      head.rotation.y += ((here ? head.userData.turn : 0) - head.rotation.y) * Math.min(1, dt * 1.5);
      const flap = flying ? Math.sin(tt * 9) : 0;
      wings.forEach((w, i) => { w.rotation.z = flying ? (0.9 + flap * 0.5) * (i ? -1 : 1) : 0; });
      obj.rotation.x = flying ? 0.35 : 0;
      for (const m of eyeMats) m.emissiveIntensity = 0.4 + (1 - dayness()) * 1.2;
      tag.update(dt, camera, tmp.copy(obj.position).setY(obj.position.y + 1.6), obj.visible);
    },
    onClick() {
      if (!obj.visible) return;
      hoot();
      openModal("🦉 Hoo the great horned owl", "He visits my oak at night. I'm always asleep, so I only know him from my trail camera photos.", `
        <p>🔄 <b>270-degree head.</b> An owl's eyes can't move in their sockets, so the whole head turns instead. Owls have 14 neck bones. (Chickens have about that many too. I tried. I can NOT do that.)</p>
        <p>🤫 <b>Silent flight.</b> Soft, fringed edges on owl feathers break up the air rushing past, so they fly with almost no sound.</p>
        <p>🗓️ <b>Hooting season.</b> November and December are when great horned owls hoot the most, claiming territory and finding a mate. Low hoots carry far on cold, still nights. The female answers higher.</p>
        <p>🐔 <b>For the record:</b> great horned owls DO eat chickens. That's why I go to bed in my coop at dusk with the door shut. We are neighbors. Not friends. Neighbors.</p>
        <p style="color:var(--muted);font-size:14px">Hoots heard this visit: ${stats.hoots}.</p>`);
    }
  };
}
