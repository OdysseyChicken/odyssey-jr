// Puddles' floating duck house: it bobs gently on the pond, its little lamp and windows glow at night,
// and clicking it gets a word from Odyssey Jr. about keeping Puddles cozy.
export default function setup({ THREE, obj, say }) {
  const baseY = obj.position.y, ry = obj.rotation.y;
  let glows = null;
  const night = () => { const h = new Date().getHours() + new Date().getMinutes() / 60; return h < 6.5 || h >= 19.5; };
  const lines = [
    "Puddles' house! It floats, so she can sleep safe out on the water.",
    "No more sleeping out in the open. Now she has a roof and straw!",
    "The little lamp comes on at night so she can find her way home.",
    "I think she likes the ramp. Ducks need a front porch too."
  ];
  function init() {
    glows = [];
    obj.traverse(n => { if (n.isMesh && /DuckLamp|Window/.test(n.name) && !/trim/i.test(n.name)) { n.material = n.material.clone(); n.material.emissive = new THREE.Color("#ffb04a"); glows.push(n); } });
  }
  let lit = 0;
  return {
    update(dt, t) {
      if (!glows) init();
      obj.position.y = baseY + 0.02 + Math.sin(t * 1.3) * 0.025;
      obj.rotation.x = Math.sin(t * 0.9) * 0.02;
      obj.rotation.z = Math.sin(t * 1.1 + 1) * 0.025;
      obj.rotation.y = ry + Math.sin(t * 0.2) * 0.05;
      lit += ((night() ? 1 : 0) - lit) * Math.min(1, dt * 0.8);
      for (const g of glows) g.material.emissiveIntensity = lit * (1.4 + 0.15 * Math.sin(t * 7));
    },
    onClick() { say(lines[Math.floor(Math.random() * lines.length)], 4); }
  };
}
