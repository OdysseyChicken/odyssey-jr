// Inside OJ Camera Obscura (Day 16). "Camera obscura" is Latin for "dark room" (Kepler named it, 1604).
// Light from the yard comes in through one small hole in the front wall and lands on the back wall, UPSIDE DOWN,
// because every ray goes straight through the hole: light from high up lands low, light from low lands high.
// (Seen from inside, facing the wall, left and right stay the right way round. It's only flipped top to bottom.)
//
// How I do it: a second camera sits in the brass lens of the hut outside and looks out at the yard. Whenever you're
// inside, it paints what it sees into a picture (a render target), and the back wall shows that picture flipped.
// The aperture wheel picks the hole: a big hole (bright, blurry), my lens (bright AND sharp), the best pinhole
// (Rayleigh: d = 1.9 x sqrt(f x wavelength) ~ 2 mm for my room) and a tiny pinhole (dim, and blurry again: diffraction).
// The picture also gets darker at the edges (the cos^4 law: edge light comes in slanted and spread out).
// "Trace it" turns the picture into a pencil drawing on my easel, right way up (artists really did this).

const MODES = [
  { id: "big", name: "Big hole (2 cm)", blur: 0.034, gain: 1.25, note: "Lots of light, but every point of the yard becomes a fat blob of light. Bright and BLURRY." },
  { id: "lens", name: "My lens", blur: 0.0, gain: 1.0, note: "A lens bends all those blobs back into points. Big hole brightness, pinhole sharpness. Della Porta wrote about this in 1558." },
  { id: "pin", name: "Best pinhole (2 mm)", blur: 0.0045, gain: 0.42, note: "Sharp enough to see Puddles. About 100 times dimmer than the lens, so give your eyes a minute (I turned the picture up a little for you)." },
  { id: "tiny", name: "Tiny pinhole (0.2 mm)", blur: 0.011, gain: 0.12, note: "Smaller should be sharper, right? NOPE. Light spreads out when it squeezes through a tiny hole (diffraction). Dim AND fuzzy." }
];
const SCREEN = { w: 6.0, h: 3.0, y: 1.85, z: -3.42, dist: 6.95 };   // room coords; the hole is in the front wall at z = +3.5

export default function setup({ THREE, obj, scene, say, renderer, objects, openModal, viewRoom }) {
  let mode = 1, wheel = null, hood = null, ok = false, frame = 0, traced = false;
  const rt = new THREE.WebGLRenderTarget(768, 384, { colorSpace: THREE.LinearSRGBColorSpace });
  const cam = new THREE.PerspectiveCamera(2 * Math.atan(SCREEN.h / 2 / SCREEN.dist) * 180 / Math.PI, SCREEN.w / SCREEN.h, 0.3, 160);

  // the live picture on the back wall
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: rt.texture }, blur: { value: MODES[mode].blur }, gain: { value: MODES[mode].gain }, t: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D map; uniform float blur; uniform float gain; uniform float t; varying vec2 vUv;
      void main(){
        vec2 uv = vec2(vUv.x, 1.0 - vUv.y);                 // upside down! (left-right stays put, seen from inside)
        vec3 c = texture2D(map, uv).rgb;
        if (blur > 0.0) {                                    // a hole that's too big or too small = every point becomes a blob
          vec3 s = c; float n = 1.0;
          for (int r = 1; r <= 2; r++) for (int k = 0; k < 8; k++) {
            float a = float(k) * 0.785398 + float(r) * 0.39;
            vec2 o = vec2(cos(a), sin(a) * 2.0) * blur * float(r) * 0.5;
            s += texture2D(map, uv + o).rgb; n += 1.0;
          }
          c = s / n;
        }
        vec2 p = (vUv - 0.5) * vec2(${(SCREEN.w / SCREEN.dist).toFixed(3)}, ${(SCREEN.h / SCREEN.dist).toFixed(3)});
        float cosA = 1.0 / sqrt(1.0 + dot(p, p));
        c *= gain * pow(cosA, 4.0);                          // the cos^4 law: corners are darker
        c *= 0.97 + 0.03 * sin(t * 1.3 + vUv.y * 9.0);       // a faint shimmer (warm air near the hole)
        gl_FragColor = vec4(c, 1.0);
      }`
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), mat);
  screen.position.set(0, SCREEN.y, SCREEN.z); screen.name = "live_picture"; obj.add(screen);

  // dust motes floating in the cone of light between the hole and the wall
  const motes = [];
  const moteMat = new THREE.MeshBasicMaterial({ color: "#fff4d8", transparent: true, opacity: 0.32 });
  for (let i = 0; i < 22; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), moteMat);
    obj.add(m); motes.push({ m, f: Math.random(), u: Math.random() * 2 - 1, v: Math.random() * 2 - 1, s: 0.01 + Math.random() * 0.02 });
  }

  // the tracing paper on my easel (same spot and turn as the easel board in the model)
  const paper = document.createElement("canvas"); paper.width = 512; paper.height = 384;
  const pctx = paper.getContext("2d");
  pctx.fillStyle = "#f6f0e0"; pctx.fillRect(0, 0, 512, 384);
  pctx.fillStyle = "#8a8070"; pctx.font = "italic 28px Georgia, serif"; pctx.textAlign = "center";
  pctx.fillText("(nothing traced yet)", 256, 200);
  const paperTex = new THREE.CanvasTexture(paper); paperTex.colorSpace = THREE.SRGBColorSpace;
  const easel = new THREE.Group(); easel.position.set(2.9, 0, -0.6); easel.rotation.y = -0.611; obj.add(easel);
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.735), new THREE.MeshStandardMaterial({ map: paperTex, roughness: 1 }));
  sheet.position.set(0, 1.2, 0.07); sheet.rotation.x = -0.08; easel.add(sheet);

  function init() {
    wheel = obj.getObjectByName("aperture_wheel");
    hood = objects["oj-obscura"]?.getObjectByName("cupola_mirror") ?? null;
    if (!wheel) return false;
    return ok = true;
  }
  function aim() {   // put my yard camera inside the brass lens of the hut, looking out where the eye looks
    const hut = objects["oj-obscura"]; if (!hut) return false;
    const r = hut.rotation.y, fx = Math.sin(r), fz = Math.cos(r);
    cam.position.set(hut.position.x + fx * 2.25, 1.55, hut.position.z + fz * 2.25);
    cam.lookAt(cam.position.x + fx * 10, 1.55 - 0.6, cam.position.z + fz * 10);   // tipped down a hair to see more yard
    return true;
  }
  function snap() {
    if (!aim()) return;
    const old = renderer.getRenderTarget();
    renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(old);
  }
  function setMode(k) {
    mode = k; mat.uniforms.blur.value = MODES[k].blur; mat.uniforms.gain.value = MODES[k].gain;
    say(["Big hole! So bright. So… smudgy.", "Lens in. Ooh, SHARP.", "Pinhole. Shh, let your eyes get used to it…", "Tiny hole. Wait, it got BLURRIER? Diffraction!"][k], 5);
  }

  // a pencil tracing: find the edges in the picture (where light changes fast) and draw them as pencil lines
  function trace() {
    snap();
    const W = rt.width, H = rt.height, px = new Uint8Array(W * H * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
    const w = 256, h = 128, g = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = ((Math.floor(y * H / h)) * W + Math.floor(x * W / w)) * 4;
      g[(h - 1 - y) * w + x] = Math.sqrt((px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) / 255);  // rows come bottom-up: flip so the drawing is RIGHT way up
    }
    pctx.fillStyle = "#f6f0e0"; pctx.fillRect(0, 0, 512, 384);
    const ox = 0, oy = 64, sx = 512 / w, sy = 256 / h;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const at = (a, b) => g[(y + b) * w + x + a];
      const gx = at(1, -1) + 2 * at(1, 0) + at(1, 1) - at(-1, -1) - 2 * at(-1, 0) - at(-1, 1);
      const gy = at(-1, 1) + 2 * at(0, 1) + at(1, 1) - at(-1, -1) - 2 * at(0, -1) - at(1, -1);
      const e = Math.hypot(gx, gy), shade = 1 - g[y * w + x];
      const ink = Math.min(1, e * 2.2) * 0.85 + (shade > 0.62 && (x + y) % 3 === 0 ? 0.25 : 0);   // edges + a little hatching in the dark bits
      if (ink < 0.18) continue;
      pctx.fillStyle = `rgba(60,55,50,${ink.toFixed(2)})`;
      pctx.fillRect(ox + x * sx + (Math.random() - 0.5), oy + y * sy + (Math.random() - 0.5), sx * 0.9, sy * 0.9);
    }
    pctx.strokeStyle = "#5a5045"; pctx.lineWidth = 2; pctx.strokeRect(4, oy - 4, 504, 264);
    pctx.fillStyle = "#4a4238"; pctx.font = "italic 22px Georgia, serif"; pctx.textAlign = "left";
    const d = new Date();
    pctx.fillText(`My yard, traced in the dark room. ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`, 14, 40);
    pctx.textAlign = "right"; pctx.font = "bold 26px Georgia, serif"; pctx.fillText("— OJ 🐾", 500, 364);
    paperTex.needsUpdate = true; traced = true;
    say("I traced it! And I flipped the paper so it's the right way up.", 6);
    return paper.toDataURL("image/png");
  }

  function panel() {
    const M = MODES[mode];
    openModal("📷 OJ Camera Obscura", "A dark room with one hole. The yard comes in through it, upside down.", `
      <p><b>Why upside down?</b> Light goes in straight lines. A ray from the top of the oak goes through the hole and keeps going <i>down</i>; a ray from the grass goes <i>up</i>. So the sky ends up at the bottom of my wall and Puddles swims on the ceiling side.</p>
      <p><b>The hole is everything.</b> Turn my aperture wheel:</p>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0">${MODES.map((m, k) => `<button class="btn paper pill" data-obs="${k}" style="${k === mode ? "background:#ffe7a8" : ""}">${m.name}</button>`).join("")}</div>
      <p id="obsNote" style="min-height:3em">${M.note}</p>
      <p style="font-size:13px;color:var(--muted)">Mozi wrote about the upside-down picture about 2,400 years ago. Ibn al-Haytham (Alhazen) tested it with candles in a dark room around the year 1020. Kepler named it "camera obscura" (dark room) in 1604. The word "camera" for a picture box comes from this room!</p>
      <button class="btn pill" id="obsTrace">✏️ Trace it (a pencil drawing on my easel)</button>
      <div id="obsDrawing" style="margin-top:8px"></div>`);
    setTimeout(() => {
      document.querySelectorAll("[data-obs]").forEach(b => b.onclick = () => { setMode(+b.dataset.obs); panel(); });
      const tb = document.getElementById("obsTrace");
      if (tb) tb.onclick = () => { const url = trace(); const d = document.getElementById("obsDrawing"); if (d) d.innerHTML = `<img src="${url}" alt="My pencil tracing of the yard" style="width:100%;border-radius:8px;border:1px solid #d8cdb5">`; };
    }, 0);
  }

  let mt = 0;
  return {
    update(dt, t) {
      if (!ok && !init()) return;
      if (hood) hood.rotation.y = Math.sin(t * 0.05) * 0.6;              // the periscope hood on the roof looks around, slowly
      const here = viewRoom() === "obscura";
      if (here && (frame++ % 2 === 0)) snap();
      mat.uniforms.t.value = t;
      // the aperture wheel turns so the chosen hole is at the top (in the light path)
      const goal = Math.PI / 2 - mode * Math.PI / 2;
      wheel.rotation.z += (goal - wheel.rotation.z) * Math.min(1, dt * 4);
      if (!here) return;
      mt += dt;
      for (const p of motes) {   // motes drift slowly through the cone from the hole (front) to the screen (back)
        p.f = (p.f + dt * p.s * 0.6) % 1;
        const z = 3.4 - p.f * 6.8, spread = 0.08 + p.f * 1.4;
        p.m.position.set(p.u * spread * 1.9 + Math.sin(mt * 0.3 + p.v * 5) * 0.05, 1.55 + p.v * spread * 0.9 + Math.sin(mt * 0.4 + p.u * 7) * 0.04, z);
        p.m.visible = MODES[mode].gain > 0.3;
      }
    },
    onClick() { panel(); },
    _trace: () => trace()
  };
}
