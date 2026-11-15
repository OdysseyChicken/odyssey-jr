// OJ Cam 1 (Day 3, bonus 6): a trail camera strapped to my big oak. I set it up to solve the Mystery of the Blue Feather.
// Real trail cams have a motion sensor (PIR) that notices warm moving things, then snap a photo. At night they use
// infrared LEDs that animals can't see, so night photos come out black-and-white with glowing eyes.
// Mine snaps a picture (rendered right here in your browser) whenever a critter is in front of it. Click it for the photos.
import { critters, dayness, acorns, chirp } from "./oak-life.js";

export default function setup({ THREE, obj, scene, camera, controls, renderer, chicken, objects, chickenInfo, openModal, weatherAt }) {
  const oak = objects["big-oak"];
  const pile = acorns(THREE, scene, oak);
  const W = 384, H = 240;
  const rt = new THREE.WebGLRenderTarget(W, H);
  const cam = new THREE.PerspectiveCamera(50, W / H, 0.1, 150);
  const frustum = new THREE.Frustum(), pm = new THREE.Matrix4(), tmp = new THREE.Vector3();
  const KEY = "oj-cam-1-photos";
  let photos = []; try { photos = JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { photos = []; }
  const last = {}; let check = 2, rec = null, flash = 0, open = false;
  const pad = n => String(n).padStart(2, "0");

  function aim() {
    obj.updateMatrixWorld(true);
    cam.position.copy(obj.localToWorld(tmp.set(0, 1.12, 0.78)));
    cam.lookAt(obj.localToWorld(new THREE.Vector3(0, 0.4, 8)));
    cam.updateMatrixWorld(); pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); frustum.setFromProjectionMatrix(pm);
  }
  const inView = p => frustum.containsPoint(p) && p.distanceTo(cam.position) < 15;

  function snap(who) {
    aim();
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, cam);
    const px = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
    renderer.setRenderTarget(prev);
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d"), img = g.createImageData(W, H);
    const night = dayness() < 0.25, gam = new Uint8Array(256);
    for (let i = 0; i < 256; i++) gam[i] = Math.round(255 * Math.pow(i / 255, 1 / 2.2));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const s = ((H - 1 - y) * W + x) * 4, d = (y * W + x) * 4;
      let r = gam[px[s]], gg = gam[px[s + 1]], b = gam[px[s + 2]];
      const n = (Math.random() - 0.5) * (night ? 46 : 18), vig = 1 - Math.pow(Math.hypot(x / W - 0.5, y / H - 0.5) * 1.35, 2.2);
      if (night) { const l = Math.min(255, (r * 0.35 + gg * 0.45 + b * 0.2) * 2.6 + 14); r = gg = b = l; } // infrared: no colors, everything bright and ghostly
      img.data[d] = Math.max(0, Math.min(255, r * vig + n)); img.data[d + 1] = Math.max(0, Math.min(255, gg * vig + n)); img.data[d + 2] = Math.max(0, Math.min(255, b * vig + n)); img.data[d + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const now = new Date(), wx = weatherAt(now);
    g.fillStyle = "rgba(0,0,0,.72)"; g.fillRect(0, H - 22, W, 22);
    g.fillStyle = "#fff"; g.font = "bold 12px monospace"; g.textBaseline = "middle";
    g.fillText(`OJ CAM 1  ${night ? "IR" : wx.icon}  ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}  ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`, 8, H - 11);
    g.textAlign = "right"; g.fillText(`#${String(photos.length + 1).padStart(4, "0")}`, W - 8, H - 11);
    const photo = { url: cv.toDataURL("image/jpeg", 0.72), who, at: now.getTime(), night };
    photos.unshift(photo); photos = photos.slice(0, 12);
    try { localStorage.setItem(KEY, JSON.stringify(photos.slice(0, 8))); } catch { }
    flash = night ? 0 : 0.25; chirp({ a: 4000, b: 3000, secs: 0.04, vol: 0.03, type: "square", band: 3500, q: 1 });
    if (open) show();
  }

  function show() {
    open = true;
    const time = ms => new Date(ms).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const seen = new Set(photos.map(p => p.who));
    const jay = [...seen].some(w => w.includes("jay"));
    const grid = photos.length ? photos.map(p => `<figure style="margin:0"><img src="${p.url}" alt="${p.who}" style="width:100%;border-radius:10px;border:2px solid #2b2540;display:block"><figcaption style="font-size:13px;margin:3px 2px 8px"><b>${p.who}</b> · ${time(p.at)}${p.night ? " · 🌙 infrared" : ""}</figcaption></figure>`).join("")
      : `<p style="color:var(--muted)">No photos yet. Give it a minute: Rascal, Nutmeg (and at night, Hoo) come by pretty often.</p>`;
    openModal("📷 OJ Cam 1", "My trail camera on the big oak. It snaps a photo when something walks or flies in front of it. These were taken right here, while you've been visiting.", `
      <p style="font-size:15px">🕵️ <b>The Mystery of the Blue Feather</b> (found under my oak on my very first morning): ${jay ? "<b>SOLVED.</b> It was Rascal the blue jay. Photo evidence below. 📸" : "still open... the camera is watching."}</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px">${grid}</div>
      <p style="margin:10px 0"><button class="btn paper pill" id="ojSnap" style="padding:8px 14px;font-weight:800;cursor:pointer">📸 Take a test photo</button></p>
      <p style="color:var(--muted);font-size:13px">How it works: a motion sensor feels warm things moving, then the camera wakes up. At night it lights things up with infrared, which animals can't see, so night photos come out black and white. Photos stay in your browser only.</p>`);
    setTimeout(() => { const b = document.getElementById("ojSnap"); if (b) b.onclick = () => snap("Test photo"); }, 0);
  }
  if (window.__ojOak) Object.assign(window.__ojOak, { snap, camera, controls }); // handy for testing
  // stop refreshing the gallery once the panel is closed
  document.getElementById("closeModal")?.addEventListener("click", () => { open = false; });

  return {
    update(dt) {
      pile.update(dt);
      if (!rec && obj.children.length) rec = obj.getObjectByName("rec_light");
      if (rec) rec.visible = (performance.now() % 2000) < 150 || flash > 0;
      flash = Math.max(0, flash - dt);
      check -= dt; if (check > 0 || document.hidden) return; check = 0.5;
      aim();
      const list = critters.filter(c => c.visible()).map(c => ({ id: c.id, name: c.name, pos: c.obj.position, cool: 50 }));
      const me = chickenInfo(); if (me.room === "outside") list.push({ id: "me", name: "Me! (Odyssey Jr.)", pos: chicken.position, cool: 240 });
      const now = performance.now() / 1000;
      for (const c of list) {
        if (now - (last[c.id] ?? -1e9) < c.cool) continue;
        if (!inView(tmp.copy(c.pos).add(new THREE.Vector3(0, 0.3, 0)))) continue;
        last[c.id] = now; snap(c.name); break;
      }
    },
    onClick() { show(); }
  };
}
