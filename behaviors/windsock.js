// A striped windsock that swings with a gentle, wandering wind. It fills up when the wind is strong
// (real ones: each stripe is about 3 knots, fully straight out is about 15 knots).
// Since Day 3 it reads the real yard weather from OJ Weather (world/weather.js): it points downwind.
export default function setup({ THREE, obj, part, say, weatherAt }) {
  const pivot = new THREE.Group(); pivot.position.set(0, 3.3, 0); obj.add(pivot);
  const segs = [];
  let parent = pivot;
  for (let i = 0; i < 5; i++) {
    const r0 = 0.22 - i * 0.025, r1 = r0 - 0.025;
    const seg = new THREE.Group(); seg.position.set(0, 0, i === 0 ? 0 : 0.4); parent.add(seg);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 0.4, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: i % 2 ? "#fff6ea" : "#ff6a2b", roughness: 0.8, side: THREE.DoubleSide }));
    m.rotation.x = Math.PI / 2; m.position.z = 0.2; m.castShadow = true; seg.add(m);
    segs.push(seg); parent = seg;
  }
  let dir = 0, gust = 0.6;
  return {
    update(dt, t) {
      const w = weatherAt ? weatherAt(new Date()) : null;
      const target = w ? -w.dir - obj.rotation.y + Math.sin(t * 0.7) * 0.12 * w.wind : Math.sin(t * 0.05) * 1.2 + Math.sin(t * 0.13) * 0.4;
      let d = target - dir; d = Math.atan2(Math.sin(d), Math.cos(d)); dir += d * dt * 0.5;
      gust = w ? Math.min(1, w.wind * 1.3 * (0.85 + 0.15 * Math.sin(t * 0.9) * Math.sin(t * 0.37 + 1))) : 0.55 + 0.35 * Math.sin(t * 0.31) * Math.sin(t * 0.17 + 1);
      pivot.rotation.y = dir;
      segs.forEach((s, i) => {
        s.rotation.x = (1 - gust) * 0.35 + Math.sin(t * 6 + i) * 0.04 * gust;   // droops when calm
        s.rotation.y = Math.sin(t * 3.1 + i * 0.8) * 0.06 * gust;
      });
    },
    onClick() { const kn = Math.round(gust * 15); say(kn > 12 ? `Windsock says about ${kn} knots. Gusty! Hold onto your goggles.` : kn < 4 ? `Windsock's droopy. About ${kn} knots. Calm skies!` : `Windsock says about ${kn} knots. Good flying weather!`, 3); }
  };
}
