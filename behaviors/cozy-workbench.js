// Cozy workbench: click it and the lantern flickers on while Odyssey Jr. tells you what he's building.
export default function setup({ THREE, obj, say }) {
  let glow = null, light = null, on = 0, timer = 0;
  const ideas = [
    "I'm building a tiny bench for the duck. Puddles deserves a seat too!",
    "Shh, I'm making a new propeller for OJ-1. Don't tell the tower.",
    "Today it's a birdhouse. For a friend. Maybe for me.",
    "I'm hammering a sign that says WELCOME. No wobbles this time!",
    "A seed scoop! Very important chicken engineering.",
    "I'm fixing the feeder lid. Then snacks. Then more building.",
    "Secret project. It has nails. That's all I can say."
  ];
  function init() {
    const lantern = obj.getObjectByName("Lantern");
    glow = obj.getObjectByName("LanternGlow");
    if (!lantern || !glow) return false;
    glow.material = glow.material.clone();
    glow.material.emissive = new THREE.Color("#ffb648");
    glow.material.emissiveIntensity = 0;
    light = new THREE.PointLight("#ffbe6a", 0, 4, 2);
    light.position.copy(glow.position);
    glow.parent.add(light);
    return true;
  }
  return {
    update(dt, t) {
      if (!glow && !init()) return;
      if (timer > 0) { timer -= dt; on = Math.min(1, on + dt * 3); }
      else on = Math.max(0, on - dt * 0.8);
      // warm candle-like flicker, a bit stronger right after it lights
      const flick = 0.75 + 0.15 * Math.sin(t * 13) + 0.1 * Math.sin(t * 29 + 1.7) + (timer > 7.5 ? 0.3 * Math.random() : 0);
      glow.material.emissiveIntensity = on * 2.2 * flick;
      light.intensity = on * 2.5 * flick;
    },
    onClick() {
      timer = 8;
      say(ideas[Math.floor(Math.random() * ideas.length)], 4);
    }
  };
}
