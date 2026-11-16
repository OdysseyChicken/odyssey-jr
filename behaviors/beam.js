// OJ Beam (Day 4 bonus): a 2-meter Yagi-Uda beam antenna on a pole, turned by hand with a crank.
// - A Yagi hears (and sends) mostly where its directors point. Reflector at the back (longest), then the driven
//   element (the only one wired to the radio), then directors, each a bit shorter. The waves add up in front and
//   mostly cancel behind. So: aim it, and a whisper becomes a voice.
// - The island where ISLE lives is far past OJ Light, at a compass bearing of about 346 degrees (north-northwest).
//   My map's coordinates: island (-280, -1130), OJ Light (40, -905), my yard at (0, 0), north is -z.
// - Other behaviors can ask: obj.userData.beam.gain("isle") (0..1, how well I'm pointed at ISLE) and .aimed().
// - Click it: crank it toward the island, toward OJ Light, or all the way around, and watch the S-meter.

const TARGETS = {
  isle: { name: "the island (ISLE)", x: -280, z: -1130 },
  light: { name: "OJ Light", x: 40, z: -905 }
};
const bearingOf = t => ((Math.atan2(t.x, -t.z) * 180 / Math.PI) + 360) % 360; // compass degrees, 0 = north
// how loud a station sounds with the beam pointed `off` radians away from it (front lobe ~50 degrees wide, about 1/12 out the back)
const pattern = off => 0.08 + 0.92 * Math.pow(Math.max(0, Math.cos(off / 2)), 40);

export default function setup({ THREE, obj, say, sim, openModal, react, chickenInfo }) {
  let head = null, crank = null, lamp = null, found = false;
  // yaw is the beam's compass bearing in radians (0 = north, clockwise). It starts pointing east (where I first hung it).
  let yaw = Math.PI / 2, target = yaw, sweep = 0, chat = 4;
  const q = new THREE.Quaternion(), v = new THREE.Vector3();

  const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const bearingRad = k => bearingOf(TARGETS[k]) * Math.PI / 180;
  const gain = k => pattern(Math.abs(wrap(bearingRad(k) - yaw)));
  const api = { gain, aimed: () => gain("isle") > 0.85, bearing: () => ((yaw * 180 / Math.PI) % 360 + 360) % 360, aim: k => { target = nearest(bearingRad(k)); } };
  obj.userData.beam = api;
  const nearest = b => yaw + wrap(b - yaw); // turn the short way round

  function find() {
    head = obj.getObjectByName("beam_head"); crank = obj.getObjectByName("crank");
    const l = obj.getObjectByName("beam_lamp");
    if (l) l.traverse(c => { if (c.isMesh && !lamp) { c.material = c.material.clone(); lamp = c.material; lamp.emissive = new THREE.Color(0.2, 1, 0.3); lamp.toneMapped = false; } });
    found = !!head;
  }

  function sMeter(g) { const s = Math.round(1 + g * 8); return { s, bar: "▮".repeat(s) + "▯".repeat(9 - s) }; }

  function panel() {
    const row = k => `<button class="btn paper pill" data-aim="${k}">🧭 ${TARGETS[k].name} · ${Math.round(bearingOf(TARGETS[k]))}°</button>`;
    openModal("📡 OJ Beam", "My Yagi beam antenna. Turn the crank, watch the needle. (Hams call a hand crank the \"armstrong rotator\".)", `
      <p style="margin:4px 0 8px">My long wire on the mast hears a little bit from everywhere. This beam hears a LOT from one direction. The longest rod at the back is the <b>reflector</b>, the one in the middle with the box is the <b>driven element</b> (the only one wired to my radio), and the shorter ones in front are <b>directors</b>. Their waves add up in front and cancel out behind.</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${row("isle")}${row("light")}<button class="btn paper pill" data-aim="spin">🔄 Crank it all the way round</button></div>
      <p style="font-size:15px;margin:6px 0"><b>Pointing:</b> <span id="bm-brg">...</span></p>
      <p style="font-size:15px;margin:6px 0"><b>ISLE on the S-meter:</b> <span id="bm-s" style="font-family:monospace;font-size:18px;color:#2b7a3a"></span></p>
      <p style="font-size:15px;margin:6px 0"><b>OJL (OJ Light):</b> <span id="bm-l" style="font-family:monospace;font-size:18px;color:#b0281a"></span></p>
      <p id="bm-note" style="font-size:13px;min-height:18px;color:#555"></p>
      <p style="font-size:13px">Why so high? My signal is on 2 meters, which mostly goes in straight lines. The radio horizon is about 4.12 × √(height in meters) kilometers, so every bit of pole helps me see over the curve of the sea.</p>`);
    document.querySelectorAll("[data-aim]").forEach(b => b.onclick = () => {
      const k = b.dataset.aim;
      if (k === "spin") { sweep = Math.PI * 2; target = yaw; } else { sweep = 0; target = nearest(bearingRad(k)); }
      react?.({ act: "beam", run: [16.8, 7.9], text: "turning OJ Beam with the hand crank", secs: 6, say: k === "isle" ? "Crank crank crank... toward the island!" : k === "light" ? "Pointing at OJ Light! Hi, lighthouse." : "Wheee, all the way round!" });
    });
  }

  function live() {
    const el = document.getElementById("bm-brg"); if (!el) return;
    const deg = Math.round(api.bearing()), dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    el.textContent = `${deg}° (${dirs[Math.round(deg / 22.5) % 16]})`;
    const a = sMeter(gain("isle")), b = sMeter(gain("light"));
    document.getElementById("bm-s").textContent = `${a.bar} S${a.s}`;
    document.getElementById("bm-l").textContent = `${b.bar} S${b.s}`;
    document.getElementById("bm-note").textContent = api.aimed() ? "🟢 Locked on the island! Go to OJ Radio and answer ISLE." : gain("light") > 0.85 ? "That's OJ Light. ISLE is a little more to the left (west)." : "";
  }

  let lastMs = null;
  return {
    update(_dt, t) {
      // real clock time (the engine caps dt, so on a slow computer the Morse would drift away from the sound)
      const nowMs = performance.now(), dt = Math.min(0.5, (nowMs - (lastMs ?? nowMs - 16)) / 1000); lastMs = nowMs;
      if (!found) { find(); if (!found) return; }
      // practicing by myself: sweep around listening, then settle on the island
      const me = chickenInfo?.();
      if (sim?.act === "beam" && me && !me.busy && me.room === "outside") {
        chat -= dt;
        if (chat <= 0) {
          chat = 7 + Math.random() * 6;
          if (Math.random() < 0.5) { target = nearest(bearingRad("isle")); say(["Three hundred forty-six degrees. That's where ISLE lives.", "Crank, crank. Crank.", "Directors point the way. Reflector says 'not that way.'", "S7 from the island! Hi, Pip."][Math.floor(Math.random() * 4)], 3.5); }
          else { target = yaw + (Math.random() - 0.5) * 2.4; }
        }
      }
      if (sweep > 0) { const s = Math.min(sweep, dt * 1.2); sweep -= s; yaw += s; target = yaw; if (sweep <= 0) target = nearest(bearingRad("isle")); }
      const before = yaw;
      yaw += Math.max(-dt * 0.7, Math.min(dt * 0.7, target - yaw)); // a hand crank is slow
      if (crank) crank.rotation.z += (yaw - before) * 14; // the wheel spins a lot for a little turn (it's geared)
      // turn the head: the boom points along the model's +Z, so find the world direction and undo the parent's turn
      v.set(Math.sin(yaw), 0, -Math.cos(yaw)); // compass bearing -> world direction (north = -z)
      if (head.parent) { head.parent.getWorldQuaternion(q); v.applyQuaternion(q.invert()); }
      head.rotation.set(0, Math.atan2(v.x, v.z), 0);
      if (lamp) lamp.emissiveIntensity = api.aimed() ? 2.2 + Math.sin(t * 3) * 0.4 : 0;
      live();
    },
    onClick() { panel(); }
  };
}
