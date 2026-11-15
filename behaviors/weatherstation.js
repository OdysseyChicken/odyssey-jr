// OJ Weather station (Day 3). It runs the sky over the whole yard:
// drifting clouds, rain showers, puddles that fill and dry up, a rainbow after the rain,
// a rooster weathervane that turns into the wind, a spinning cup anemometer and a rain gauge that fills up.
// The weather itself comes from world/weather.js (the same for every visitor).
export default function setup({ THREE, obj, scene, camera, say, weatherAt, openWeather, viewRoom, dress, wearing, outfits, sim }) {
  const vane = obj.getObjectByName("vane"), cups = obj.getObjectByName("anemometer"), level = obj.getObjectByName("rain_level");
  const vaneParentRot = () => obj.rotation.y; // the station may be turned; the vane must still point at the real wind
  let w = weatherAt(new Date()), vaneDir = w.dir;

  // ---- clouds: puffy groups of squashed spheres, drifting with the wind ----
  const cloudMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, transparent: true, opacity: 0.95 });
  const puff = new THREE.SphereGeometry(1, 14, 10);
  const clouds = [];
  const R = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    const n = 4 + Math.floor(Math.random() * 4);
    for (let j = 0; j < n; j++) {
      const m = new THREE.Mesh(puff, cloudMat);
      const s = R(1.6, 3.2);
      m.scale.set(s * R(1, 1.4), s * 0.7, s);
      m.position.set((j - n / 2) * R(1.6, 2.4), R(-0.4, 0.8), R(-1.2, 1.2));
      g.add(m);
    }
    g.position.set(R(-55, 55), R(17, 25), R(-55, 55));
    g.userData = { order: Math.random(), scale: 0 };
    g.scale.setScalar(0.001); g.visible = false;
    scene.add(g); clouds.push(g);
  }
  clouds.sort((a, b) => a.userData.order - b.userData.order);

  // ---- rain: short streaks falling around wherever the camera is looking ----
  const N = 1800, box = 44, top = 22;
  const pos = new Float32Array(N * 6), speed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = R(-box / 2, box / 2), y = R(0, top), z = R(-box / 2, box / 2);
    pos.set([x, y, z, x, y + 0.6, z], i * 6); speed[i] = R(16, 22);
  }
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: "#cfe3ff", transparent: true, opacity: 0, depthWrite: false });
  const rain = new THREE.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; scene.add(rain);

  // ---- puddles: flat dark-blue patches that grow while it rains and shrink as they dry ----
  const puddleMat = new THREE.MeshStandardMaterial({ color: "#5d7fa8", roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.55, depthWrite: false });
  const puddles = [[3, -3], [-4, 1], [6, 1.5], [-2, -9.5], [-14, 6], [11, -6], [2, 12], [-8, -12], [14, 13]].map(([x, z]) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 28), puddleMat);
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.025, z); m.scale.set(R(0.9, 1.6), R(0.6, 1), 1); m.userData.base = m.scale.clone();
    m.receiveShadow = true; m.visible = false; scene.add(m); return m;
  });
  let wet = 0; // 0 dry .. 1 soaked

  // ---- rainbow: seven bands, red on the outside, violet inside, opposite the sun ----
  const rainbow = new THREE.Group();
  const bands = ["#ff4b4b", "#ff9a3c", "#ffe14a", "#58d26b", "#4aa8ff", "#5a5cff", "#a45cff"];
  bands.forEach((c, i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(40 - i * 1.1, 0.58, 6, 96, Math.PI),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    rainbow.add(m);
  });
  rainbow.visible = false; scene.add(rainbow); // a real rainbow is a circle around the point straight opposite the sun from YOU, so it follows the camera

  const wind = new THREE.Vector3(), look = new THREE.Vector3();
  let gaugeLevel = 0, chatter = 0, rainGear = null;
  const hasRainGear = (outfits ?? []).some(o => o.id === "rainy-day");
  return {
    update(dt, t) {
      if (Math.floor(t * 2) !== Math.floor((t - dt) * 2)) w = weatherAt(new Date()); // refresh twice a second
      const outside = viewRoom() === "outside";
      // the wind blows FROM w.dir, so things drift the opposite way. dir 0 = from north (-z).
      wind.set(-Math.sin(w.dir), 0, Math.cos(w.dir)).multiplyScalar(0.3 + w.wind * 2.2);

      // weathervane: the beak points INTO the wind. Swings with a little wobble when it's gusty.
      let d = w.dir + Math.sin(t * 1.3) * 0.08 * w.wind - vaneDir; d = Math.atan2(Math.sin(d), Math.cos(d)); vaneDir += d * Math.min(1, dt * 1.5);
      if (vane) vane.rotation.y = Math.PI - vaneDir - vaneParentRot();
      if (cups) cups.rotation.y -= dt * (1 + w.wind * 14);
      gaugeLevel += (Math.min(1, w.rainMM / 30) - gaugeLevel) * Math.min(1, dt);
      if (level) level.scale.y = Math.max(0.02, gaugeLevel);

      // clouds: show more of them the cloudier it gets, grey them when it rains, darken at night
      const want = Math.round(w.cloud * clouds.length);
      const sky = scene.background, lum = sky ? (sky.r + sky.g + sky.b) / 3 : 1;
      cloudMat.color.setRGB(1, 1, 1).multiplyScalar(Math.min(1, 0.35 + lum * 0.9) * (1 - w.rain * 0.38));
      clouds.forEach((c, i) => {
        const goal = i < want ? 1 : 0;
        c.userData.scale += (goal - c.userData.scale) * Math.min(1, dt * 0.4);
        c.visible = c.userData.scale > 0.02; c.scale.setScalar(Math.max(0.001, c.userData.scale));
        c.position.addScaledVector(wind, dt * 0.5);
        if (c.position.x > 60) c.position.x -= 120; if (c.position.x < -60) c.position.x += 120;
        if (c.position.z > 60) c.position.z -= 120; if (c.position.z < -60) c.position.z += 120;
      });

      // rain falls around the camera's focus, slanted by the wind
      rainMat.opacity += ((outside ? w.rain * 0.55 : 0) - rainMat.opacity) * Math.min(1, dt * 2);
      rain.visible = rainMat.opacity > 0.01;
      if (rain.visible) {
        const c = scene.userData.focus ?? new THREE.Vector3();
        const p = rainGeo.attributes.position.array, sx = wind.x * 0.25, sz = wind.z * 0.25;
        const active = Math.floor(N * (0.25 + 0.75 * w.rain));
        for (let i = 0; i < N; i++) {
          const k = i * 6;
          if (i >= active) { p[k + 1] = p[k + 4] = -50; continue; }
          p[k + 1] -= speed[i] * dt; p[k] += sx * speed[i] * dt * 0.1; p[k + 2] += sz * speed[i] * dt * 0.1;
          if (p[k + 1] < 0) { p[k] = c.x + R(-box / 2, box / 2); p[k + 2] = c.z + R(-box / 2, box / 2); p[k + 1] = R(top * 0.6, top); }
          p[k + 3] = p[k] - sx * 0.06; p[k + 4] = p[k + 1] + 0.6; p[k + 5] = p[k + 2] - sz * 0.06;
        }
        rainGeo.attributes.position.needsUpdate = true;
      }

      // puddles: fill in the rain, dry slowly in sun and wind
      wet = Math.max(0, Math.min(1, wet + (w.rain > 0 ? w.rain * 0.05 : -(0.004 + w.wind * 0.004) * (1 - w.cloud * 0.6)) * dt));
      if (w.rain > 0.3 && wet < 0.4) wet = 0.4; // after a page reload mid-shower
      if (w.afterRain && wet === 0) wet = 0.5;
      puddles.forEach((m, i) => {
        const s = Math.max(0, wet * 1.2 - i * 0.04);
        m.visible = s > 0.03; m.scale.set(m.userData.base.x * s, m.userData.base.y * s, 1);
      });

      // rainbow fades in right after a shower when the sun comes out
      rainbow.visible = w.rainbow > 0.01 && outside;
      if (rainbow.visible) {
        // sun is up in the +x+z sky, so the rainbow sits -x-z. Lift the top of the arc to just under the top of the view.
        camera.getWorldDirection(look); const pitch = Math.asin(look.y), top = pitch + THREE.MathUtils.degToRad(camera.fov) * 0.46;
        const y = camera.position.y + 70 * Math.tan(top) - 40;
        rainbow.position.set(camera.position.x - 0.8 * 70, y, camera.position.z - 0.6 * 70);
        rainbow.lookAt(camera.position.x, y, camera.position.z);
      }
      rainbow.children.forEach(m => m.material.opacity = w.rainbow * 0.55);

      // when it really rains he puts on his yellow rain hat, and changes back when it stops
      const awakeOut = !sim || (sim.room === "outside" && sim.act !== "sleep" && sim.act !== "nap");
      const wantGear = hasRainGear && w.rain > 0.3 && awakeOut; // no rain hat in bed
      if (wantGear !== rainGear) { if (rainGear !== null || wantGear) dress?.(wantGear ? "rainy-day" : wearing); if (rainGear !== null && wantGear) say("Rain hat on! Bawk.", 3); rainGear = wantGear; }

      // now and then he comments on the weather if it just changed
      chatter -= dt;
      if (chatter <= 0 && awakeOut) { chatter = 240 + Math.random() * 240; if (w.rainbow > 0.2) say("A RAINBOW! Bawk bawk bawk!", 5); else if (w.rain > 0.6) say("It's pouring! Everybody under the oak!", 4); }
    },
    onClick() {
      say(w.rain > 0 ? `${w.name}! ${w.rainMM.toFixed(1)} mm in my rain gauge so far.` : `${w.name}. Wind ${w.knots} knots from the ${w.from}.`, 4);
      openWeather();
    }
  };
}
