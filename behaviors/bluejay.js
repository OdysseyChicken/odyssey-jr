// Rascal the blue jay (Day 3, bonus 6). He's the one who's been leaving blue feathers under my oak!
// In the daytime he drops in every few minutes: lands in the oak, hops down for acorns (up to 3 at once: a couple in his
// throat pouch and one in his bill), then hides each one somewhere in my yard, one per spot. Sometimes he grabs a snack
// at my seed feeder. And sometimes, from up in the oak, he does a perfect red-shouldered HAWK call... and I hit the deck.
// Blue jays really do all of this. They also plant whole oak forests by forgetting some of their acorns.
import { critters, stats, dayness, chirp, panFor, volFor, perchOn, acorns, cacheSpot, arc, makeTag } from "./oak-life.js";

export default function setup({ THREE, obj, scene, say, chicken, camera, objects, react, chickenInfo, weatherAt, openModal }) {
  const oak = objects["big-oak"], feeder = objects["feeder"];
  const pile = acorns(THREE, scene, oak);
  const tag = makeTag();
  critters.push({ id: "bluejay", name: "Rascal the blue jay", kind: "jay", obj, visible: () => obj.visible });
  obj.visible = false;
  let head = null, wings = [], tail = null, carried = null, gen = null, wait = 6 + Math.random() * 10;
  let flying = false, pecking = 0, calling = 0, hopping = false, t = 0, lastMimic = -999;
  const tmp = new THREE.Vector3();

  const face = p => { obj.rotation.y = Math.atan2(p.x - obj.position.x, p.z - obj.position.z); };
  const oakPerch = () => { for (let i = 0; i < 6; i++) { const a = Math.random() * Math.PI * 2, r = 1.2 + Math.random() * 0.9; const p = perchOn(THREE, oak, Math.cos(a) * r, Math.sin(a) * r); if (p && p.y > 3) return p; } return oak.position.clone().add(new THREE.Vector3(1.2, 5, 0)); };
  const topOf = id => perchOn(THREE, objects[id]) ?? null;
  const far = () => { const a = Math.random() * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * 34, 10 + Math.random() * 4, Math.sin(a) * 34); };

  // ---- little sounds ----
  const where = () => ({ pan: panFor(camera, obj.position), vol: volFor(camera, obj.position, 0.16) });
  function jayCall(n = 2) { const { pan, vol } = where(); for (let i = 0; i < n; i++) { chirp({ a: 2900, b: 1700, secs: 0.2, at: i * 0.32, vol, band: 2600, q: 1.4, pan }); chirp({ a: 1450, b: 900, secs: 0.2, at: i * 0.32, vol: vol * 0.5, band: 1500, q: 1.4, pan }); } }
  function hawkCall() { const { pan, vol } = where(); for (let i = 0; i < 2; i++) { chirp({ a: 2400, b: 2700, secs: 0.12, at: i * 0.9, vol: vol * 1.3, type: "square", band: 2600, q: 2, pan }); chirp({ a: 2700, b: 1500, secs: 0.6, at: i * 0.9 + 0.1, vol: vol * 1.3, type: "square", band: 2300, q: 2, pan }); } }
  function chickenScream() { chirp({ a: 3000, b: 2600, secs: 0.7, vol: 0.06, type: "sine", band: 2800, q: 0.8 }); }

  // ---- moves (generators: each yield waits one frame) ----
  function* pause(secs, fn) { let s = 0; while (s < secs) { const dt = yield; s += dt; fn?.(s, dt); } }
  function* flyTo(p, h) {
    const a = obj.position.clone(), d = a.distanceTo(p), dur = Math.max(0.45, d / 6.5), H = h ?? Math.min(3.5, 0.3 + d * 0.22);
    face(p); flying = true; let s = 0;
    while (s < dur) { const dt = yield; s += dt; arc(obj.position, a, p, H, Math.min(1, s / dur)); }
    flying = false; obj.position.copy(p);
  }
  function* hopTo(p) { // jays hop with both feet on the ground
    face(p);
    while (obj.position.distanceTo(p) > 0.1) {
      const a = obj.position.clone(), step = Math.min(0.45, a.distanceTo(p)), b = a.clone().add(tmp.subVectors(p, a).setLength(step));
      hopping = true; yield* pause(0.22, s => arc(obj.position, a, b, 0.12, s / 0.22)); obj.position.copy(b); hopping = false; yield* pause(0.12);
    }
  }
  function* peck(secs) { pecking = secs; yield* pause(secs); pecking = 0; }
  function* look(secs) { yield* pause(secs, (s, dt) => { if (head && Math.random() < dt * 1.5) head.userData.turn = (Math.random() - 0.5) * 2.2; }); }

  function* visit() {
    obj.position.copy(far()); obj.visible = true;
    yield* flyTo(oakPerch(), 2);
    tag.speak(["JAY! JAY!", "Jeer! Jeer!", "*bob bob*"][Math.floor(Math.random() * 3)]); calling = 0.8; jayCall(2);
    yield* look(2.5 + Math.random() * 3);
    // gather 1 to 3 acorns from under the oak
    const want = 1 + Math.floor(Math.random() * 3); let got = 0;
    for (let i = 0; i < want; i++) {
      const a = pile.nearest(obj.position.x, obj.position.z); if (!a) break;
      const p = a.position.clone().setY(0);
      if (i === 0) yield* flyTo(p, 1.2); else yield* hopTo(p);
      if (a.userData.taken) continue;
      yield* peck(0.7); pile.take(a); got++;
      if (got === 1) carried.visible = true;
      if (got === 2) tag.speak("*gulp* (one in my throat pouch)", 2);
    }
    // hide each one in a different spot
    for (let i = 0; i < got; i++) {
      const [x, z] = cacheSpot(obj.position);
      yield* flyTo(new THREE.Vector3(x, 0, z), 1.6);
      yield* peck(1.4); pile.mound(x, z); stats.cached++;
      if (i === got - 1) carried.visible = false;
      yield* look(0.6);
    }
    // a snack at my feeder?
    if (feeder && Math.random() < 0.5) { const f = topOf("feeder"); if (f) { yield* flyTo(f, 1.5); yield* peck(2.5); yield* look(1); } }
    // back up somewhere high to show off
    const hi = [oakPerch(), topOf("oj-weather"), topOf("welcome-sign"), topOf("fence-map-board")].filter(Boolean);
    yield* flyTo(hi[Math.floor(Math.random() * hi.length)], 2); yield* look(2);
    const me = chickenInfo();
    if (me.room === "outside" && !me.up && !me.busy && t - lastMimic > 240 && Math.random() < 0.55 && obj.position.distanceTo(chicken.position) < 22) {
      lastMimic = t; calling = 2; hawkCall(); tag.speak("KEE-ahh! KEE-ahh!", 2.5); stats.mimics++;
      yield* pause(0.6);
      const sp = new THREE.Vector3(oak.position.x + 1.1, 0, oak.position.z + 1.1);
      if (react({ act: "alarm", icon: "😱", secs: 6, run: [sp.x, sp.z], text: "Odyssey Jr. heard a HAWK, screamed, and dove under the oak! (It was Rascal the blue jay doing an impression.)", say: "EEEEEE! HAWK!!", sayFor: 3 })) {
        chickenScream();
        yield* look(6.5);
        say(["…wait. That was RASCAL?! You feathered FAKER!", "There's no hawk. It's the JAY. AGAIN.", "Very funny, Rascal. Very. Funny."][Math.floor(Math.random() * 3)], 5);
        tag.speak("*jay laugh*", 2); jayCall(3);
      }
      yield* look(2);
    } else { jayCall(1); yield* look(2); }
    yield* flyTo(far(), 3);
    obj.visible = false;
  }

  return {
    update(dt, tt) {
      t = tt; pile.update(dt);
      if (!head && obj.children.length) {
        head = obj.getObjectByName("jay_head"); tail = obj.getObjectByName("jay_tail");
        wings = ["jay_wing_l", "jay_wing_r"].map(n => obj.getObjectByName(n)).filter(Boolean);
        carried = pile.make(); carried.scale.setScalar(0.8); carried.rotation.x = Math.PI / 2; carried.position.set(0, 0.06, 0.24); carried.visible = false; (head ?? obj).add(carried);
        if (head) head.userData.turn = 0;
      }
      if (!head) return;
      if (gen) { if (gen.next(dt).done) { gen = null; wait = 60 + Math.random() * 100; } }
      else {
        wait -= dt;
        if (wait <= 0) { const w = weatherAt(new Date()); if (dayness() > 0.35 && w.rain < 0.6) gen = visit(); else wait = 30; }
      }
      // pose
      const flap = flying ? Math.sin(tt * 34) : 0;
      wings.forEach((w, i) => { w.rotation.y = 0; w.rotation.z = flying ? (0.3 + flap * 0.9) * (i ? -1 : 1) : 0; });
      obj.rotation.x = flying ? -0.15 : hopping ? -0.1 : 0;
      head.rotation.y += ((head.userData.turn ?? 0) - head.rotation.y) * Math.min(1, dt * 6);
      head.rotation.x = pecking > 0 ? Math.max(0, Math.sin(tt * 14)) * 0.9 : calling > 0 ? -0.35 : 0;
      calling = Math.max(0, calling - dt);
      if (tail) tail.rotation.x = calling > 0 ? Math.sin(tt * 20) * 0.25 : (Math.sin(tt * 1.3) > 0.97 ? 0.3 : 0); // tail flick
      tag.update(dt, camera, tmp.copy(obj.position).setY(obj.position.y + 0.9), obj.visible);
    },
    onClick() {
      if (!obj.visible) return;
      tag.speak("JAY! JAY!", 2); calling = 0.8; jayCall(2);
      openModal("🐦 Rascal the blue jay", "The one who's been leaving blue feathers under my oak. Mystery SOLVED.", `
        <p>🌰 <b>Acorn planter.</b> In the fall a blue jay hides <b>thousands</b> of acorns, one per spot. He carries up to 5 at a time: 2 or 3 in a stretchy throat pouch, one in his mouth, one at the tip of his bill. The ones jays forget grow into oak trees. Jays helped oaks spread back north after the Ice Age!</p>
        <p>🦅 <b>Hawk impressions.</b> Blue jays copy hawk calls, especially red-shouldered hawks. Nobody knows exactly why. Maybe to scare other birds off the food. Maybe to scare chickens. (It works on chickens.)</p>
        <p>🪶 <b>Not really blue!</b> A blue jay feather has no blue color in it. Tiny bubbles inside the feather scatter blue light back at you, like the sky does. Crush one, or hold it up with light behind it, and it's just brown.</p>
        <p style="color:var(--muted);font-size:14px">This visit: ${stats.cached} acorns hidden in my yard by my neighbors, ${stats.mimics} fake hawk ${stats.mimics === 1 ? "call" : "calls"}.</p>`);
    }
  };
}
