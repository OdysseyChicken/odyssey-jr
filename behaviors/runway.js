// Runway edge lights: dim by day, glowing at night, with a "rabbit" pulse racing down the runway.
export default function setup({ THREE, obj }) {
  let lights = null;
  return {
    update(dt, t) {
      if (!lights) {
        const m = [];
        obj.traverse(n => { if (n.isMesh && /runway_light/.test(n.material?.name ?? "")) {
          n.material = n.material.clone();            // each light gets its own glow
          m.push({ n, x: n.getWorldPosition(new THREE.Vector3()).x, green: /green/.test(n.material.name) });
        } });
        if (!m.length) return; lights = m;
      }
      const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
      const dark = h < 6.5 || h >= 19.5 ? 1 : h < 7.5 ? 7.5 - h : h > 18.5 ? h - 18.5 : 0;
      for (const L of lights) {
        const rabbit = L.green ? 0 : Math.max(0, Math.sin(t * 3 - L.x * 0.35)) ** 8;
        L.n.material.emissiveIntensity = 0.3 + dark * (2.2 + rabbit * 3);
      }
    }
  };
}
