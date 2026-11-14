// OJ-1, Odyssey Jr.'s little yellow plane. Click it (or wait) and it takes off, loops around the yard and lands.
// Phases: parked -> roll -> fly (along a curve) -> land (rollout) -> turn -> taxi back -> turn -> parked.
export default function setup({ THREE, obj, data, say }) {
  const Z = obj.position.z, X0 = obj.position.x;          // runway centerline z, parking spot x (facing +x)
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const path = new THREE.CatmullRomCurve3([
    V(4, 0, Z), V(12, 1.5, Z), V(20, 4.5, Z + 1), V(27, 7, Z + 8), V(26, 10, Z + 22), V(14, 12, Z + 33),
    V(-6, 12, Z + 35), V(-24, 9, Z + 27), V(-31, 7, Z + 12), V(-30, 4.5, Z + 2), V(-22, 1.8, Z), V(-14, 0, Z)
  ], false, "centripetal");
  const len = path.getLength();
  obj.rotation.order = "YXZ";
  let phase = "parked", t = 0, nextFlight = Date.now() + (40 + Math.random() * 60) * 1000, prop = null, spin = 0, lastYaw = Math.PI / 2;
  const night = () => { const h = new Date().getHours(); return h < 6 || h >= 21; };
  const pose = (x, y, z, yaw, pitch = 0, bank = 0) => { obj.position.set(x, y, z); obj.rotation.set(pitch, yaw, bank); };
  const start = () => {
    if (phase !== "parked") { say("She's already up there! Look up! Bawk!", 3); return; }
    if (night()) { say("Too dark to fly. OJ-1 is sleeping in her spot.", 3); return; }
    phase = "roll"; t = 0; say(["Contact! Clear prop!", "Cleared for takeoff on runway 9!", "Flaps... um, wings out! Here we go!"][Math.floor(Math.random() * 3)], 3);
  };
  return {
    update(dt) {
      if (!prop) prop = obj.getObjectByName("propeller");
      const running = phase !== "parked";
      spin = THREE.MathUtils.lerp(spin, running ? 45 : 0, dt * 2);
      if (prop) prop.rotation.z += spin * dt;
      t += dt;
      if (phase === "parked") { if (!night() && Date.now() > nextFlight) { nextFlight = Date.now() + (150 + Math.random() * 120) * 1000; start(); } return; }
      if (phase === "roll") {               // speed up from the parking spot to the start of the curve
        const T = 5, u = Math.min(t / T, 1), x = X0 + (4 - X0) * u * u;
        pose(x, 0, Z, Math.PI / 2, -0.12 * u * u);
        if (u >= 1) { phase = "fly"; t = 0; }
      } else if (phase === "fly") {
        const u = Math.min(t * 7 / len, 1), p = path.getPointAt(u), d = path.getTangentAt(u);
        const yaw = Math.atan2(d.x, d.z), h = Math.hypot(d.x, d.z);
        let dyaw = yaw - lastYaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw)); lastYaw = yaw;
        const bank = THREE.MathUtils.clamp(-dyaw / Math.max(dt, 1e-3) * 0.9, -0.7, 0.7);
        obj.rotation.z = THREE.MathUtils.lerp(obj.rotation.z, bank, dt * 3);
        pose(p.x, p.y, p.z, yaw, -Math.atan2(d.y, h), obj.rotation.z);
        if (u >= 1) { phase = "land"; t = 0; say("Smooth landing! I'm basically a pilot now.", 3); }
      } else if (phase === "land") {         // roll out and slow down
        const T = 5, u = Math.min(t / T, 1), x = -14 + 20 * (1 - (1 - u) * (1 - u));
        pose(x, 0, Z, Math.PI / 2);
        if (u >= 1) { phase = "turn1"; t = 0; }
      } else if (phase === "turn1" || phase === "turn2") { // spin around on the spot
        const u = Math.min(t / 2.5, 1), from = phase === "turn1" ? Math.PI / 2 : -Math.PI / 2;
        obj.rotation.set(0, from + Math.PI * u, 0);
        if (u >= 1) { if (phase === "turn1") { phase = "taxi"; t = 0; } else { phase = "parked"; t = 0; lastYaw = Math.PI / 2; obj.rotation.set(0, Math.PI / 2, 0); } }
      } else if (phase === "taxi") {          // putter back to the parking spot
        const T = 9, u = Math.min(t / T, 1);
        pose(6 + (X0 - 6) * u, 0, Z, -Math.PI / 2);
        if (u >= 1) { phase = "turn2"; t = 0; }
      }
    },
    onClick: start
  };
}
