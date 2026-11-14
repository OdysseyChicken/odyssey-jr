// Puddles the duck: a female mallard who lives in the pond. She paddles around, tips "bottoms up" to dabble for food,
// tucks her bill into her back feathers to sleep at night, swims over when Odyssey Jr. visits the pond,
// and does the mallard "decrescendo call" (quacks that get softer) when a visitor clicks her.
export default function setup({ THREE, obj, data, scene, say, chicken, sim, camera }) {
  const C = new THREE.Vector2(...(data.center ?? [obj.position.x, obj.position.z])), R = data.radius ?? 1.8;
  let head = null, feet = [], yaw = 0, goal = new THREE.Vector2(), pause = 2, dabble = 0, nextDabble = 12, nextRipple = 0, talk = 0;
  const pos = new THREE.Vector2(obj.position.x, obj.position.z);
  const pick = () => { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * R; goal.set(C.x + Math.cos(a) * r, C.y + Math.sin(a) * r); };
  pick();
  const night = () => { const h = new Date().getHours(); return h < 6 || h >= 21; };

  // ripples that spread out behind her
  const rings = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.36, 32), new THREE.MeshBasicMaterial({ color: "#eaf6ff", transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.075; m.userData.life = 0; scene.add(m); rings.push(m);
  }
  const ripple = (s = 1) => { const r = rings.find(r => r.userData.life <= 0) ?? rings[0]; r.position.x = pos.x; r.position.z = pos.y; r.userData.life = 1; r.userData.s = s; };

  // her own little speech bubble
  const tag = document.createElement("div");
  Object.assign(tag.style, { position: "fixed", transform: "translate(-50%,-100%)", background: "#fffaf0", border: "2px solid #2b2540", borderRadius: "12px",
    padding: "2px 9px", font: "800 13px Nunito, sans-serif", color: "#2b2540", pointerEvents: "none", opacity: 0, transition: "opacity .3s", zIndex: 5, whiteSpace: "nowrap" });
  document.body.appendChild(tag);
  let tagT = 0;
  const speak = (txt, secs = 2.5) => { tag.textContent = txt; tagT = secs; };

  // the decrescendo call: QUACK quack quack quack, each one softer
  let ac = null;
  function quack() {
    try {
      ac ??= new (window.AudioContext || window.webkitAudioContext)();
      const t0 = ac.currentTime;
      for (let i = 0; i < 5; i++) {
        const t = t0 + i * 0.24, vol = 0.22 * Math.pow(0.68, i);
        const o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
        o.type = "sawtooth"; o2.type = "square";
        o.frequency.setValueAtTime(560 - i * 12, t); o.frequency.exponentialRampToValueAtTime(330, t + 0.16);
        o2.frequency.setValueAtTime(282 - i * 6, t); o2.frequency.exponentialRampToValueAtTime(165, t + 0.16);
        f.type = "bandpass"; f.frequency.value = 1150; f.Q.value = 2.5;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
        o.connect(f); o2.connect(f); f.connect(g); g.connect(ac.destination);
        o.start(t); o2.start(t); o.stop(t + 0.2); o2.stop(t + 0.2);
      }
    } catch (e) { /* no sound, no problem */ }
  }

  return {
    update(dt, t) {
      if (!head) { head = obj.getObjectByName("duck_head"); feet = ["duck_foot_l", "duck_foot_r"].map(n => obj.getObjectByName(n)).filter(Boolean); }
      const asleep = night();
      // is Odyssey Jr. at the pond? then swim over to say hi
      const visiting = (sim.act === "drink" || sim.act === "visit") && Math.hypot(chicken.position.x - C.x, chicken.position.z - C.y) < 5.5;
      if (visiting && !asleep) {
        const d = new THREE.Vector2(chicken.position.x - C.x, chicken.position.z - C.y); const L = d.length() || 1;
        goal.set(C.x + d.x / L * Math.min(R, L - 0.9), C.y + d.y / L * Math.min(R, L - 0.9)); pause = 0;
        talk -= dt; if (talk < 0) { talk = 9 + Math.random() * 8; speak(["Quack!", "Quack quack!", "*happy wiggle*", "Quaaack."][Math.floor(Math.random() * 4)]); }
      }
      const toGoal = new THREE.Vector2().subVectors(goal, pos), dist = toGoal.length();
      let speed = 0;
      if (asleep) { speed = 0.03; if (dist < 0.1) pick(); }
      else if (dabble > 0) speed = 0;
      else if (dist > 0.12) speed = visiting ? 0.55 : 0.32;
      else { pause -= dt; if (pause < 0) { pause = 2 + Math.random() * 5; pick(); } }
      if (speed > 0 && dist > 0.05) {
        toGoal.normalize(); pos.addScaledVector(toGoal, Math.min(dist, speed * dt));
        let dy = Math.atan2(toGoal.x, toGoal.y) - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); yaw += dy * Math.min(1, dt * 2.5);
        nextRipple -= dt; if (nextRipple < 0 && !asleep) { nextRipple = 0.7; ripple(1); }
      } else if (visiting) {
        let dy = Math.atan2(chicken.position.x - pos.x, chicken.position.z - pos.y) - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); yaw += dy * Math.min(1, dt * 2);
      }
      // bottoms up! dabbling for pond weeds every so often
      if (!asleep && !visiting) { nextDabble -= dt; if (nextDabble < 0 && dabble <= 0) { dabble = 3.2; nextDabble = 14 + Math.random() * 20; ripple(1.4); } }
      let tip = 0;
      if (dabble > 0) { dabble -= dt; const u = 1 - dabble / 3.2; tip = Math.sin(Math.min(1, u * 1.15) * Math.PI) ** 0.5 * 1.25; if (dabble <= 0) ripple(1.6); }
      const bob = Math.sin(t * 2.1) * 0.015 + Math.sin(t * 3.3) * 0.008;
      obj.position.set(pos.x, bob - tip * 0.08, pos.y);
      obj.rotation.set(tip + Math.sin(t * 1.7) * 0.03, yaw, Math.sin(t * 1.3) * 0.04, "YXZ");
      if (head) {
        head.userData.p0 ??= head.position.clone();
        if (asleep) { head.rotation.set(-2.9, 0.35, 0); head.position.set(head.userData.p0.x, head.userData.p0.y + 0.26, head.userData.p0.z - 0.12); } // bill tucked into her back feathers
        else head.position.copy(head.userData.p0), head.rotation.set(Math.sin(t * 0.9) * 0.08 + (tagT > 2 ? Math.sin(t * 30) * 0.12 : 0), Math.sin(t * 0.6) * 0.3, 0);
      }
      feet.forEach((f, i) => f.rotation.x = speed > 0.1 ? Math.sin(t * 9 + i * Math.PI) * 0.6 : 0);
      for (const r of rings) {
        if (r.userData.life <= 0) { r.material.opacity = 0; continue; }
        r.userData.life -= dt / 2.2; const k = 1 - r.userData.life;
        r.scale.setScalar((0.6 + k * 2.2) * r.userData.s); r.material.opacity = r.userData.life * 0.5;
      }
      tagT -= dt;
      const p = new THREE.Vector3(pos.x, 1.05, pos.y).project(camera);
      tag.style.left = (p.x * 0.5 + 0.5) * innerWidth + "px"; tag.style.top = (-p.y * 0.5 + 0.5) * innerHeight + "px";
      tag.style.opacity = tagT > 0 && p.z < 1 ? 1 : 0;
    },
    onClick() {
      if (night()) { speak("zzz…"); say("Shh, Puddles is sleeping. Ducks can sleep with one eye open, though!", 4); return; }
      quack(); speak("QUACK! quack quack quack…", 2.8); ripple(1.2);
      say(["That's Puddles! She's my pond friend.", "Puddles says hi! (only girl mallards do the big quack)", "Bawk! Puddles, you're so loud!"][Math.floor(Math.random() * 3)], 3.5);
    }
  };
}
