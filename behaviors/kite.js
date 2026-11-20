// OJ Kites (Day 8 bonus): my Eddy kite flies over the yard whenever there's kite wind (world/kite.js).
// On good days I tie it off on the kite post's reel and it flies all day. When I go out to fly it myself, the line
// goes into my beak and the kite follows me. It hangs low in light air, climbs steep in a gentle breeze, and swoops
// and tugs when it's too windy, and then I reel it in. A ribbon tail of bows hangs off the bottom.
// The brass pointer on the Beaufort board shows today's wind number. Click the post to launch it (or try to).
import { kiteAt } from "../world/kite.js";

export default function setup({ THREE, obj, scene, say, sim, chicken, objects, openModal }) {
  let kite, reel, eye, pointer, ok = false;
  const rest = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() };
  const BRIDLE = new THREE.Vector3(0, -0.1, 0.38);    // where the line ties on, in the kite's own frame (front = +z)
  const TAILTIP = new THREE.Vector3(0, -0.87, 0);
  function init() {
    kite = obj.getObjectByName("kite"); reel = obj.getObjectByName("reel"); eye = obj.getObjectByName("line_eye"); pointer = obj.getObjectByName("bft_pointer");
    if (!kite) return false;
    kite.traverse(c => { if (c.isMesh) { c.material = c.material.clone(); c.material.side = THREE.DoubleSide; c.castShadow = true; } });
    // bridle strings: from the top and bottom of the spine out to the tow point
    const bm = new THREE.MeshStandardMaterial({ color: "#f4efe6", roughness: 0.9 });
    for (const a of [new THREE.Vector3(0, 0.42, 0.01), new THREE.Vector3(0, -0.8, 0.01)]) {
      const d = BRIDLE.clone().sub(a), m = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, d.length(), 5), bm);
      m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); kite.add(m);
    }
    rest.p.copy(kite.position); rest.q.copy(kite.quaternion); rest.s.copy(kite.scale);
    objects["oj-kite-flying"] = kite;   // so I can turn and look at it while I fly it
    ok = true; return true;
  }

  // the tail: a chain of little bows that trails off the bottom of the kite
  const N = 10, SEG = 0.36, tail = [], bows = [];
  const bowGeo = new THREE.ConeGeometry(0.11, 0.2, 4); bowGeo.rotateZ(Math.PI / 2); bowGeo.translate(0.1, 0, 0);
  const bowMats = ["#e8402f", "#ffcc33", "#3a62c9"].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, side: THREE.DoubleSide }));
  const tailGroup = new THREE.Group(); tailGroup.visible = false; scene.add(tailGroup);
  for (let i = 0; i < N; i++) {
    tail.push(new THREE.Vector3());
    const b = new THREE.Group(), m = bowMats[i % 3];
    const l = new THREE.Mesh(bowGeo, m), r = new THREE.Mesh(bowGeo, m); r.rotation.y = Math.PI; b.add(l, r); b.scale.setScalar(0.9 + (i % 2) * 0.2);
    tailGroup.add(b); bows.push(b);
  }
  const tailLine = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: "#f4efe6", roughness: 0.9 }));
  tailGroup.add(tailLine);

  // the kite line: a fat-ish tube (thin lines vanish in my halftone print) with a little sag in the middle
  const lineMat = new THREE.MeshStandardMaterial({ color: "#fbf7ee", roughness: 0.9 });
  const line = new THREE.Mesh(new THREE.BufferGeometry(), lineMat); line.visible = false; scene.add(line);
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());

  let K = kiteAt(), tick = 0, L = 0, air = 0, elev = 0.3, launchUntil = -1e9, flopUntil = -1e9, wasFlying = false, lineT = 0, ptrY = null;
  const anchor = new THREE.Vector3(), anchorGoal = new THREE.Vector3(), tmp = new THREE.Vector3(), restW = new THREE.Vector3(), restQW = new THREE.Quaternion();
  const flyQ = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, "YXZ"), pos = new THREE.Vector3(), bridleW = new THREE.Vector3();
  const inHand = () => sim?.act === "kite" && chicken && Math.hypot(chicken.position.x - obj.position.x, chicken.position.z - obj.position.z) < 5;

  return {
    update(dt, t) {
      if (!ok && !init()) return;
      tick -= dt; if (tick <= 0) { tick = 3; K = kiteAt(); }
      const now = performance.now() / 1000;
      const flying = (K.flyable || now < launchUntil) && now > flopUntil;
      if (flying && !wasFlying && inHand()) say(K.knots < 7 ? "Up, up… come on, little kite!" : "Let out some line… there she goes!", 4);
      if (!flying && wasFlying && inHand()) say(K.knots > 19 ? "Too windy! Reel in, reel in!" : "Wind's gone. Coming down…", 4);
      wasFlying = flying;

      // who's holding it: me (line in my beak) or the reel on the post
      if (eye) eye.getWorldPosition(anchorGoal); else anchorGoal.copy(obj.position).setY(1.1);
      if (inHand()) anchorGoal.set(chicken.position.x, chicken.position.y + 1.25, chicken.position.z).add(tmp.set(Math.sin(chicken.rotation.y), 0, Math.cos(chicken.rotation.y)).multiplyScalar(0.45));
      if (anchor.lengthSq() === 0) anchor.copy(anchorGoal); else anchor.lerp(anchorGoal, Math.min(1, dt * 3));

      // line out / reel in (the reel spins either way)
      const Lgoal = flying ? K.line : 0, dL = THREE.MathUtils.clamp(Lgoal - L, -dt * 2.2, dt * (L < 3 ? 1.2 : 1.6));
      L += dL; if (reel) reel.rotation.x -= dL / 0.13;
      air = THREE.MathUtils.clamp(air + (flying || L > 1.2 ? dt : -dt) * 0.8, 0, 1);

      // where the kite is: downwind of the anchor, up at the line angle, with gusts and swoops
      const g = Math.sin(t * 0.9) * 0.5 + Math.sin(t * 2.3 + 1) * 0.3 + Math.sin(t * 0.31) * 0.6;
      const eGoal = flying ? K.elev + g * 0.08 * (1 + K.swoop) - K.swoop * 0.3 * Math.max(0, Math.sin(t * 0.7)) : 0.35;
      elev += (eGoal - elev) * Math.min(1, dt * 0.8);
      const az = Math.sin(t * 0.43) * 0.12 + Math.sin(t * 1.1 + 2) * 0.05 + K.swoop * Math.sin(t * 0.9) * 0.45;
      const down = K.dir + Math.PI + az;                                  // the way the wind blows TO
      const dx = Math.sin(down), dz = -Math.cos(down);                   // dir 0 = from the north (-z), so it blows to +z
      const Lr = Math.max(L, 0.6);
      pos.set(anchor.x + dx * Lr * Math.cos(elev), anchor.y + Lr * Math.sin(elev), anchor.z + dz * Lr * Math.cos(elev));
      // face back up the line toward whoever holds it, leaning back into the wind, rocking a little
      e.set(-(0.42 + 0.15 * Math.sin(t * 1.7)), Math.atan2(-dx, -dz), Math.sin(t * 1.3) * 0.12 + K.swoop * Math.sin(t * 0.9 + 0.6) * 0.5, "YXZ");
      flyQ.setFromEuler(e);

      // blend between resting on the post and flying
      obj.updateMatrixWorld(); restW.copy(rest.p).applyMatrix4(obj.matrixWorld); obj.getWorldQuaternion(restQW).multiply(rest.q);
      const k = air * air * (3 - 2 * air);
      if (k > 0.001) {
        if (kite.parent !== scene) scene.attach(kite);
        kite.position.copy(restW).lerp(pos, k); kite.quaternion.copy(restQW).slerp(flyQ, k); kite.scale.copy(rest.s).multiplyScalar(1 + 0.5 * k);
      } else if (kite.parent !== obj) { obj.add(kite); kite.position.copy(rest.p); kite.quaternion.copy(rest.q); kite.scale.copy(rest.s); }

      // the line
      line.visible = k > 0.02;
      if (line.visible && (lineT -= dt) <= 0) {
        lineT = 1 / 30;
        kite.updateMatrixWorld(); bridleW.copy(BRIDLE).applyMatrix4(kite.matrixWorld);
        curve.v0.copy(anchor); curve.v2.copy(bridleW);
        curve.v1.copy(anchor).lerp(bridleW, 0.5); curve.v1.y -= 0.05 * L * (1.2 - Math.min(1, K.knots / 12));
        line.geometry.dispose(); line.geometry = new THREE.TubeGeometry(curve, 28, 0.035, 5, false);
      }

      // the tail (a little rope-and-bows sim: each bow hangs off the one before, blown downwind)
      tailGroup.visible = k > 0.3;
      if (tailGroup.visible) {
        kite.updateMatrixWorld(); tail[0].copy(TAILTIP).applyMatrix4(kite.matrixWorld);
        const push = tmp.set(dx * (0.6 + K.knots * 0.05), -0.65, dz * (0.6 + K.knots * 0.05));
        for (let i = 1; i < N; i++) {
          const p = tail[i]; if (p.lengthSq() === 0) p.copy(tail[i - 1]);
          p.addScaledVector(push, dt * 2); p.x += Math.sin(t * 5 + i * 0.7) * dt * 0.6;
          const d = p.clone().sub(tail[i - 1]); const len = d.length() || 1; p.copy(tail[i - 1]).addScaledVector(d, SEG / len);
        }
        for (let i = 0; i < N; i++) { bows[i].position.copy(tail[i]); bows[i].rotation.set(Math.sin(t * 6 + i) * 0.4, Math.atan2(-dx, -dz) + Math.PI / 2, Math.sin(t * 4 + i) * 0.3); }
        tailLine.geometry.dispose(); tailLine.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tail), 24, 0.015, 4, false);
      } else tail.forEach(p => p.set(0, 0, 0));

      // pull on my beak while I fly it
      if (chicken) chicken.userData.kiteTug = inHand() && k > 0.5 ? (0.3 + K.swoop) * (0.5 + 0.5 * Math.sin(t * 1.9) * Math.sin(t * 0.7 + 1)) : 0;

      // Beaufort pointer: row k is at height 1.5 + k*0.1
      if (pointer) { if (ptrY == null) ptrY = pointer.position.y; pointer.position.y += (ptrY + Math.min(6, K.bft) * 0.1 - pointer.position.y) * Math.min(1, dt * 2); }
    },
    onClick() {
      K = kiteAt();
      const now = performance.now() / 1000;
      if (!K.flyable && K.knots >= 4 && K.knots <= 22) { launchUntil = now + 40; say(`${K.why.split(".")[0]}… but okay, one quick flight, just for you!`, 4); }
      else if (!K.flyable && K.knots < 4) { flopUntil = -1e9; launchUntil = now + 3.5; setTimeout(() => { flopUntil = performance.now() / 1000 + 6; }, 3500); say("Not enough wind. Watch: I run, it goes up… it goes up… flop.", 5); }
      else say(K.knots < 7 ? "Light breeze! It's up, but it's hanging low. Lots of slack." : K.knots < 14 ? "Gentle breeze: perfect kite wind! Look how steep the line is!" : "It's pulling SO hard. If I let go I'll fly too.", 4);
      const rows = ["0 Calm", "1 Light air", "2 Light breeze", "3 Gentle breeze", "4 Moderate breeze", "5 Fresh breeze", "6 Strong breeze"]
        .map((r, i) => `<div style="padding:4px 8px;border-radius:6px;${i === K.bft ? "background:#ffe28a;font-weight:700" : ""}">${i === K.bft ? "👉 " : ""}${r}${i === 3 ? " ⭐ best kite wind" : i === 6 ? " (reel in!)" : ""}</div>`).join("");
      openModal("🪁 OJ Kites", `My Eddy kite and my Beaufort board.${K.fake ? " (Pretend wind from ?kitewind in the address.)" : ""}`, `
        <p><b>Wind now:</b> about ${Math.round(K.knots)} knots from the ${K.from}. That's Beaufort <b>${K.bft}</b>, ${K.word.toLowerCase()}: ${K.sign}.</p>
        <p>${K.flyable ? "🪁 <b>Kite's up!</b> I tied it off on the reel. It flies all day while the wind holds." : "🪁 " + K.why}</p>
        ${rows}
        <p style="margin-top:10px">My kite is an <b>Eddy kite</b>: William Eddy (1890s) bent the cross stick back like a bow, so the two halves of the sail make a shallow V and it steadies itself. He used kites to lift thermometers and took the first kite photo in America in 1895. A real Eddy doesn't need a tail. Mine has one anyway, because bows are pretty and my first one spun.</p>
        <p>A kite balances on its bridle (the little strings to the line). Wind pushes on the sail, the line holds it back, and the push gets turned into lift, just like OJ-1's wings. Gentle steady wind = a steep, high line. Light wind = low and floppy. Too much = swoops, dives, snapped sticks.</p>`);
    }
  };
}
