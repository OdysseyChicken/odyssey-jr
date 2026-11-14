// OJ Tower: the rotating airport beacon (green + white back to back = "land airport"), soft light beams at night,
// a glowing cab, a light-gun flash for OJ-1 and a "tower view" camera when a visitor clicks it.
export default function setup({ THREE, obj, say, sim, camera, controls, objects, setFollow }) {
  let beacon = null, glass = [], gun = null, beams = null;
  const plane = objects?.["plane-oj1"];
  const dark = () => { const d = new Date(), h = d.getHours() + d.getMinutes() / 60; return h < 6.5 || h >= 19.5 ? 1 : h < 7.5 ? 7.5 - h : h > 18.5 ? h - 18.5 : 0; };
  let view = 0, viewing = false, saved = null, lastAir = false, lastMoving = false, gunT = 0, gunColor = "#3cff6a";
  const cab = new THREE.Vector3(), look = new THREE.Vector3();

  function init() {
    beacon = obj.getObjectByName("beacon");
    if (!beacon) return false;
    obj.traverse(n => { if (n.isMesh && /tower_glass|tower_lamp/.test(n.material?.name ?? "")) { n.material = n.material.clone(); glass.push(n); } });
    // two long soft beams that sweep the sky at night
    const m = new THREE.MeshBasicMaterial({ color: "#fff", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    beams = new THREE.Group();
    [["#7dff9a", 1], ["#fff4d6", -1]].forEach(([c, s]) => {
      const g = new THREE.ConeGeometry(1.4, 14, 20, 1, true); g.translate(0, -7, 0); g.rotateZ(s * Math.PI / 2 + s * -0.08);
      const b = new THREE.Mesh(g, m.clone()); b.material.color.set(c); beams.add(b);
    });
    beacon.add(beams);
    // the light gun: a little lamp in the cab window that shines at OJ-1
    gun = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: gunColor, transparent: true, opacity: 0 }));
    gun.position.set(0.3, 5.7, 1.2); obj.add(gun);
    return true;
  }
  const inTower = () => sim.act === "tower";
  function startView() {
    viewing = true; view = 0; setFollow(false);
    saved = { pos: camera.position.clone(), tgt: controls.target.clone() };
    say(inTower() ? "Welcome to my tower! Watch OJ-1 from up here." : "Tower view! This is what I see from the balcony.", 4);
  }
  function endView() { viewing = false; view = 0; if (saved) { camera.position.copy(saved.pos); controls.target.copy(saved.tgt); } setFollow(true); }
  controls.addEventListener("start", () => { if (viewing) { viewing = false; saved = null; } });

  return {
    update(dt, t) {
      if (!beacon && !init()) return;
      const d = dark();
      beacon.rotation.z = 0; beacon.rotation.y += dt * Math.PI * 2 / 4; // one turn every 4 s = 15 green + 15 white flashes a minute
      beams.children.forEach(b => b.material.opacity = d * 0.13);
      glass.forEach(n => n.material.emissiveIntensity = 0.15 + d * 1.6);

      if (plane) {
        // OJ-1 starts rolling: steady green from the light gun ("cleared for takeoff"); in the air: radio chatter
        const moving = plane.position.x !== (plane.userData.x0 ??= plane.position.x) || plane.position.y > 0.05;
        const air = plane.position.y > 1;
        if (moving && !lastMoving) { gunT = 3; gunColor = "#3cff6a"; if (inTower()) say("OJ Tower: OJ-1, runway 9, cleared for takeoff! Steady green!", 4); }
        if (air && !lastAir && inTower()) say("OJ Tower: OJ-1 is airborne. Have a nice loop!", 3);
        if (!air && lastAir) { gunT = 3; if (inTower()) say("OJ Tower: Welcome back, OJ-1. Taxi to the hangar.", 4); }
        lastAir = air; lastMoving = moving;
      }
      if (gunT > 0) { gunT -= dt; gun.material.color.set(gunColor); gun.material.opacity = Math.min(1, gunT) * (0.6 + 0.4 * Math.sin(t * 20)); }
      else gun.material.opacity = 0;

      if (viewing) {
        view += dt;
        obj.localToWorld(cab.set(1.35, 6.1, 1.35));
        if (plane && plane.position.y > 0.3) look.copy(plane.position); else look.set(0, 0.5, -14);
        const k = Math.min(1, dt * 1.5);
        camera.position.lerp(cab, k); controls.target.lerp(look, k * 1.5);
        if (view > 30) endView();
      }
    },
    onClick() { if (viewing) endView(); else startView(); }
  };
}
