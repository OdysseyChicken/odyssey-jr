// Nutmeg the eastern gray squirrel (Day 3, bonus 6). She lives up in my big oak (her leaf nest is called a drey).
// In the daytime she comes down the trunk HEAD FIRST (squirrels can turn their back feet around!), bounds over to an acorn,
// and either sits up and eats it or buries it. If she thinks someone is watching (me!), she sometimes does a FAKE bury:
// digs, pretends to drop it in, pats the dirt... and runs off still holding it. Real gray squirrels do this. Sneaky.
import { critters, stats, dayness, chirp, panFor, volFor, acorns, cacheSpot, makeTag } from "./oak-life.js";

export default function setup({ THREE, obj, scene, say, chicken, camera, objects, chickenInfo, weatherAt, openModal }) {
  const oak = objects["big-oak"], C = oak.position;
  const pile = acorns(THREE, scene, oak);
  const tag = makeTag();
  critters.push({ id: "squirrel", name: "Nutmeg the squirrel", kind: "squirrel", obj, visible: () => obj.visible });
  obj.visible = false; obj.rotation.order = "YXZ";
  let head = null, tail = null, held = null, gen = null, wait = 4 + Math.random() * 8;
  let running = false, digging = 0, sitting = false, nibbling = false, flick = 0, t = 0;
  const tmp = new THREE.Vector3();
  const R = y => 0.588 - 0.0974 * y + 0.1;   // the oak trunk's radius at height y (plus a squirrel)

  function chatter() { const pan = panFor(camera, obj.position), vol = volFor(camera, obj.position, 0.1);
    for (let i = 0; i < 6; i++) chirp({ a: 1900, b: 1300, secs: 0.06, at: i * 0.09, vol, type: "square", band: 1800, q: 2, pan });
    chirp({ a: 1700, b: 900, secs: 0.45, at: 0.6, vol: vol * 0.8, type: "sawtooth", band: 1500, q: 2, pan }); }

  function* pause(secs, fn) { let s = 0; while (s < secs) { const dt = yield; s += dt; fn?.(s, dt); } }
  // around and around the trunk: up (nose up) or down (head first)
  function* trunk(y0, y1, a0, turns) {
    const dur = Math.abs(y1 - y0) / 1.3; let s = 0; const down = y1 < y0;
    while (s < dur) {
      const dt = yield; s += dt; const k = Math.min(1, s / dur), y = y0 + (y1 - y0) * k, a = a0 + turns * Math.PI * 2 * k, r = R(y);
      obj.position.set(C.x + Math.cos(a) * r, y, C.z + Math.sin(a) * r);
      obj.rotation.x = down ? Math.PI / 2 : -Math.PI / 2;
      // belly against the bark
      obj.rotation.y = down ? Math.atan2(obj.position.x - C.x, obj.position.z - C.z) : Math.atan2(C.x - obj.position.x, C.z - obj.position.z);
    }
    return a0 + turns * Math.PI * 2;
  }
  function* runTo(x, z) {
    obj.rotation.x = 0; obj.rotation.y = Math.atan2(x - obj.position.x, z - obj.position.z); running = true;
    const a = obj.position.clone().setY(0), b = new THREE.Vector3(x, 0, z), d = a.distanceTo(b), dur = d / 3.4; let s = 0;
    while (s < dur) { const dt = yield; s += dt; obj.position.lerpVectors(a, b, Math.min(1, s / dur)); }
    running = false; obj.position.y = 0; flick = 0.8;
  }
  function* sitLook(secs) { sitting = true; yield* pause(secs, (s, dt) => { if (head && Math.random() < dt * 2) head.userData.turn = (Math.random() - 0.5) * 1.6; }); sitting = false; }
  const watched = () => { const me = chickenInfo(); return me.room === "outside" && !me.up && Math.hypot(chicken.position.x - obj.position.x, chicken.position.z - obj.position.z) < 4.5; };

  function* outing() {
    let a = Math.random() * Math.PI * 2;
    obj.visible = true;
    a = yield* trunk(3.0, 0.9, a, -0.6);
    yield* pause(0.8, () => { flick = 0.5; });               // the classic pose: stuck head-down on the trunk, looking around
    yield* trunk(0.9, 0.2, a, -0.1);
    obj.position.y = 0; obj.rotation.x = 0;
    const errands = 1 + Math.floor(Math.random() * 3);
    for (let e = 0; e < errands; e++) {
      const nut = pile.nearest(obj.position.x, obj.position.z); if (!nut) break;
      yield* runTo(nut.position.x, nut.position.z); if (nut.userData.taken) continue;
      digging = 0.5; yield* pause(0.5); digging = 0; pile.take(nut); held.visible = true;
      yield* sitLook(0.8);
      if (Math.random() < 0.35) { // eat it right here, sitting up
        sitting = true; nibbling = true; tag.speak("*nibble nibble nibble*", 2.5); yield* pause(4); nibbling = false; sitting = false; held.visible = false; stats.eaten++;
        yield* pause(0.3, () => { flick = 0.6; });
        continue;
      }
      // bury it. But if someone's watching, maybe fake it first
      let [x, z] = cacheSpot(C); x = C.x + (x - C.x) * 0.6; z = C.z + (z - C.z) * 0.6;
      yield* runTo(x, z);
      if (watched() && Math.random() < 0.7) {
        digging = 1.4; yield* pause(1.4); digging = 0; pile.mound(x, z); tag.speak("*pat pat* (it's not in there!)", 2.5); stats.fakes++;
        if (Math.random() < 0.6) say(["Did she just… pretend to bury that?!", "Nutmeg! I SAW you keep it!", "Fake bury. She thinks I'm a thief. I'm a CHICKEN."][Math.floor(Math.random() * 3)], 4);
        yield* sitLook(0.6);
        [x, z] = cacheSpot(C); yield* runTo(C.x + (x - C.x) * 0.7, C.z + (z - C.z) * 0.7);
      }
      digging = 1.6; yield* pause(1.6); digging = 0; held.visible = false; pile.mound(obj.position.x, obj.position.z); stats.cached++;
      yield* pause(0.4, () => { flick = 0.6; });
      if (watched() && Math.random() < 0.4) { chatter(); tag.speak("kuk-kuk-kuk-QUAAA!", 2); yield* pause(1.2, () => { flick = 1; }); }
    }
    yield* sitLook(1 + Math.random() * 2);
    const b = Math.atan2(obj.position.z - C.z, obj.position.x - C.x);
    yield* runTo(C.x + Math.cos(b) * R(0), C.z + Math.sin(b) * R(0));
    yield* trunk(0.2, 3.0, b, 0.75);
    obj.visible = false;
  }

  return {
    update(dt, tt) {
      t = tt; pile.update(dt);
      if (!head && obj.children.length) {
        head = obj.getObjectByName("sq_head"); tail = obj.getObjectByName("sq_tail");
        held = pile.make(); held.scale.setScalar(0.9); held.position.set(0, 0.07, 0.2); held.visible = false; obj.add(held);
        if (head) head.userData.turn = 0;
      }
      if (!head) return;
      if (gen) { if (gen.next(dt).done) { gen = null; wait = 45 + Math.random() * 75; } }
      else { wait -= dt; if (wait <= 0) { const w = weatherAt(new Date()); if (dayness() > 0.35 && w.rain < 0.5) gen = outing(); else wait = 30; } }
      // pose: bounding run, sitting up, digging with front paws, and the tail that never stops talking
      const onTree = Math.abs(obj.rotation.x) > 1;
      if (!onTree) {
        obj.rotation.x = sitting ? -0.85 : running ? Math.sin(tt * 16) * 0.18 : 0;
        if (running) obj.position.y = Math.abs(Math.sin(tt * 16)) * 0.14;
        else if (sitting) obj.position.y = 0.04;
        if (digging > 0) { obj.rotation.x = 0.25 + Math.sin(tt * 30) * 0.06; digging -= dt; }
      }
      head.rotation.y += ((head.userData.turn ?? 0) - head.rotation.y) * Math.min(1, dt * 7);
      head.rotation.x = nibbling ? Math.sin(tt * 25) * 0.08 + 0.2 : 0;
      held.position.set(0, sitting ? 0.18 : 0.07, sitting ? 0.16 : 0.22);
      flick = Math.max(0, flick - dt);
      if (tail) { tail.rotation.x = (running ? -0.5 : 0) + (flick > 0 ? Math.sin(tt * 28) * 0.35 : Math.sin(tt * 1.1) * 0.04); }
      tag.update(dt, camera, tmp.copy(obj.position).setY(obj.position.y + 0.9), obj.visible);
    },
    onClick() {
      if (!obj.visible) return;
      tag.speak("kuk-kuk-kuk!", 2); chatter(); flick = 1.2;
      openModal("🐿️ Nutmeg the squirrel", "An eastern gray squirrel. She lives in a leaf nest (a drey) way up in my big oak.", `
        <p>🌰 <b>A scatter-hoarder.</b> Gray squirrels bury nuts one at a time, all over the place, then find most of them again later by memory and smell. (The ones they don't find can grow into trees too.)</p>
        <p>🎭 <b>Fake burying!</b> When somebody is watching, gray squirrels sometimes dig a hole, pretend to drop a nut in, cover it up and pat it down... and walk off still holding the nut. Scientists watched this in 500 trials. She does it to ME.</p>
        <p>🙃 <b>Head-first down trees.</b> Squirrels can turn their back ankles all the way around, so their claws can hook the bark while they come down head first.</p>
        <p>🗣️ <b>Tail talk.</b> A flicking tail means "I'm alert" or "I see you." The chatter "kuk-kuk-kuk-quaaa" is a squirrel scolding.</p>
        <p style="color:var(--muted);font-size:14px">This visit: ${stats.eaten} acorns eaten on the spot, ${stats.fakes} fake ${stats.fakes === 1 ? "bury" : "buries"}.</p>`);
    }
  };
}
