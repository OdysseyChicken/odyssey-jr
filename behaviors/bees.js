// OJ Bees (Day 11): wild honeybees live inside my bee tree (the old russet oak in the north-west corner, far-oak-4).
// The math is in world/bees.js (runs on my yard's weather + the real date).
// - On a sunny day around 50 °F they pop out of the knothole for a quick cleansing flight: little loops in front of the
//   tree, then straight back in. In spring/summer they forage farther.
// - On cool days one or two guards peek out at the door. When it's cold: nobody. They're a warm ball inside.
// - Click the tree: a cut-away of the hollow (the cluster, its core and shell temperatures, honey left), when they can
//   fly next, and you can KNOCK GENTLY (like real beekeepers do in winter) and hear them hum back.
// ?beeday pretends it's a warm sunny flying day.
import { beesAt, flightWindows, swarmSeason, FLY_F } from "../world/bees.js";

const PRETEND = typeof location !== "undefined" && new URLSearchParams(location.search).has("beeday");
const fmtH = d => d.toLocaleTimeString([], { hour: "numeric" });
const dayName = d => { const n = new Date(); const t = new Date(n); t.setDate(n.getDate() + 1);
  return d.toDateString() === n.toDateString() ? "today" : d.toDateString() === t.toDateString() ? "tomorrow" : d.toLocaleDateString([], { weekday: "long" }); };

export default function setup({ THREE, obj, scene, say, sim, chicken, openModal, react, chickenInfo }) {
  let door = null, ok = false, B = null, tick = 0, chat = 4, knockUntil = -1, audio = null;
  const doorW = new THREE.Vector3(), out = new THREE.Vector3(), side = new THREE.Vector3(), tmp = new THREE.Vector3(), prev = new THREE.Vector3();

  // a bee: fuzzy yellow body with dark bands, a dark head, two glassy wings. Bigger than life so they survive my halftone print.
  const yellow = new THREE.MeshStandardMaterial({ color: "#f2b632", roughness: 0.8 });
  const black = new THREE.MeshStandardMaterial({ color: "#2a1e14", roughness: 0.7 });
  const wingM = new THREE.MeshStandardMaterial({ color: "#eef6ff", roughness: 0.3, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
  const bodyG = new THREE.SphereGeometry(0.06, 10, 8), headG = new THREE.SphereGeometry(0.04, 8, 6);
  const bandG = new THREE.CylinderGeometry(0.061, 0.061, 0.022, 10), wingG = new THREE.CircleGeometry(0.06, 8);
  const N = 46, bees = [], swarm = new THREE.Group(); scene.add(swarm);
  for (let i = 0; i < N; i++) {
    const g = new THREE.Group(), body = new THREE.Mesh(bodyG, yellow); body.scale.set(1, 1, 1.45); g.add(body);
    for (const z of [-0.025, 0.025]) { const b = new THREE.Mesh(bandG, black); b.rotation.x = Math.PI / 2; b.position.z = z; g.add(b); }
    const h = new THREE.Mesh(headG, black); h.position.z = 0.095; g.add(h);
    const wings = [];
    for (const s of [-1, 1]) { const w = new THREE.Mesh(wingG, wingM); w.scale.set(0.7, 1.3, 1); w.rotation.x = -Math.PI / 2; const p = new THREE.Group(); p.position.set(s * 0.03, 0.045, 0.01); w.position.x = s * 0.055; p.add(w); g.add(p); wings.push(p); }
    g.scale.setScalar(1.35); g.visible = false; swarm.add(g);
    const r = (k => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); });
    bees.push({ g, wings, T: 5 + r(1) * 6, off: r(2) * 20, R: r(3), H: r(4), dir: r(5) < 0.5 ? -1 : 1, spread: 0.6 + r(6) * 1.0 });
  }

  function init() {
    door = obj.getObjectByName("bee_door"); if (!door) return false;
    ok = true; return true;
  }
  function refresh() {
    B = beesAt(new Date());
    if (PRETEND) Object.assign(B, { mode: "cleansing", n: 34, air: 56, clustered: true });
    // a lone bee peeks out on cool bright days, even if she won't fly
    if (B.mode === "cluster" && B.alt > 8 && B.air >= 37 && !B.wet) { B.mode = "peek"; B.n = 1; }
  }

  // ---------- knock + hum (WebAudio, only after a click) ----------
  function knock() {
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      const ac = audio, t0 = ac.currentTime + 0.02, loud = B?.mode === "night" ? 0.7 : 1;
      // two soft knocks on wood: short low thumps
      for (const dt of [0, 0.28]) {
        const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine";
        o.frequency.setValueAtTime(180, t0 + dt); o.frequency.exponentialRampToValueAtTime(70, t0 + dt + 0.12);
        g.gain.setValueAtTime(0.0001, t0 + dt); g.gain.exponentialRampToValueAtTime(0.5, t0 + dt + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.16);
        o.connect(g).connect(ac.destination); o.start(t0 + dt); o.stop(t0 + dt + 0.2);
      }
      // the hum: thousands of wings and shivering muscles. A low buzz (~220-250 Hz) that swells up, then settles down.
      const h0 = t0 + 0.75, f = 215 + (B?.air ?? 40) * 0.6;
      const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900; lp.Q.value = 0.7;
      const amp = ac.createGain(); amp.gain.setValueAtTime(0.0001, h0);
      amp.gain.exponentialRampToValueAtTime(0.16 * loud, h0 + 0.35); amp.gain.setValueAtTime(0.16 * loud, h0 + 1.6);
      amp.gain.exponentialRampToValueAtTime(0.0001, h0 + 3.6);
      const trem = ac.createOscillator(), tg = ac.createGain(); trem.frequency.value = 7.5; tg.gain.value = 0.04 * loud; trem.connect(tg).connect(amp.gain);
      lp.connect(amp).connect(ac.destination);
      for (const [mult, type, v] of [[1, "sawtooth", 0.5], [1.013, "sawtooth", 0.45], [0.994, "triangle", 0.5], [2.01, "sawtooth", 0.15]]) {
        const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f * mult * 0.97, h0);
        o.frequency.linearRampToValueAtTime(f * mult * 1.04, h0 + 0.5); o.frequency.linearRampToValueAtTime(f * mult, h0 + 3.5);
        g.gain.value = v; o.connect(g).connect(lp); o.start(h0); o.stop(h0 + 3.8);
      }
      trem.start(h0); trem.stop(h0 + 3.8);
    } catch (e) { /* no sound, that's okay */ }
    // if it isn't freezing out, a couple of guards come to the door to see who's there
    if (B && B.air >= 34 && B.alt > 0) knockUntil = performance.now() / 1000 + 7;
    say(B?.mode === "night" ? "Knock knock… hmmmmmm. They're awake in there. Bees never really sleep in winter." : "Knock knock… HMMMMMMMMM. A happy hum. They're alive and well!", 4);
  }

  // ---------- the cut-away (an SVG of the inside of the tree) ----------
  function cutaway() {
    const W = 520, H = 300, cx = 210, R = 92 * B.radius;
    const combs = [130, 170, 210, 250, 290].map(x => `<rect x="${x - 9}" y="40" width="18" height="215" rx="9" fill="url(#comb)" stroke="#8a5a1a" stroke-width="1.5"/>`).join("");
    // honey sits up top; the cluster hangs just under it and eats its way up through the winter
    const honeyBottom = 40 + 215 * 0.55 * Math.min(1, B.stores / 60), cy = Math.min(250 - R * 0.8, honeyBottom + R * 0.7);
    const brood = B.brood > 0.1 ? `<ellipse cx="${cx}" cy="${cy}" rx="${22 * B.brood + 10}" ry="${30 * B.brood + 12}" fill="#f6e2b8" stroke="#b07a2a" stroke-dasharray="3 2"/><text x="${cx}" y="${cy + 4}" font-size="10" text-anchor="middle" fill="#7a4a10">brood</text>` : "";
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;background:#f3ead2;border-radius:10px;border:2px solid #2b2540">
      <defs><pattern id="comb" width="10" height="9" patternUnits="userSpaceOnUse"><rect width="10" height="9" fill="#c98a2a"/><path d="M0 4.5 L2.5 0 L7.5 0 L10 4.5 L7.5 9 L2.5 9 Z" fill="#e6a83a" stroke="#9a6418" stroke-width=".8"/></pattern>
      <radialGradient id="ball"><stop offset="0" stop-color="#ff5a2a"/><stop offset=".55" stop-color="#ffa63a"/><stop offset="1" stop-color="#f6c84a" stop-opacity=".95"/></radialGradient></defs>
      <rect x="60" y="10" width="300" height="280" rx="70" fill="#6b4a2e"/><rect x="95" y="30" width="230" height="240" rx="50" fill="#2c1d12"/>
      ${combs}
      <rect x="100" y="34" width="220" height="${Math.max(0, honeyBottom - 34)}" fill="#ffcf4a" fill-opacity=".35"/>
      <text x="${cx}" y="54" font-size="12" font-weight="800" text-anchor="middle" fill="#fff3c4" stroke="#5a3a10" stroke-width="2.5" paint-order="stroke">honey up top</text>
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#ball)" stroke="#5a3a10" stroke-width="2" stroke-dasharray="2 3" opacity=".92"/>
      ${brood}
      <circle cx="${cx + R * 0.7}" cy="${cy + R * 0.7}" r="6" fill="#c9302c" stroke="#fff"/><text x="${cx + R * 0.7 + 9}" y="${cy + R * 0.7 + 4}" font-size="10" fill="#fff">queen</text>
      <ellipse cx="${cx}" cy="262" rx="16" ry="10" fill="#111"/><text x="${cx}" y="288" font-size="11" text-anchor="middle" fill="#f3ead2">knothole door (faces south)</text>
      <g font-size="13" fill="#2b2540"><text x="380" y="40" font-weight="800">Inside</text>
      <text x="380" y="62">🔴 core: <tspan font-weight="800">${Math.round(B.core)}°F</tspan></text>
      <text x="380" y="84">🟡 shell: <tspan font-weight="800">${Math.round(B.shell)}°F</tspan></text>
      <text x="380" y="118" font-weight="800">Outside</text>
      <text x="380" y="140">🌡️ air: <tspan font-weight="800">${Math.round(B.air)}°F</tspan></text>
      <text x="380" y="174" font-weight="800">Honey left</text>
      <rect x="380" y="184" width="120" height="14" rx="7" fill="#fff" stroke="#2b2540"/><rect x="380" y="184" width="${120 * Math.min(1, B.stores / 60)}" height="14" rx="7" fill="#f2b632"/>
      <text x="380" y="216">about ${Math.round(B.stores)} lb</text></g></svg>`;
  }
  function panel() {
    refresh();
    const words = {
      cleansing: `☀️ <b>They're OUT!</b> It's ${Math.round(B.air)}°F and sunny, so they're zipping out for a quick <b>cleansing flight</b> (a bathroom break: bees won't poop inside all winter). Then straight back in.`,
      forage: `🌼 <b>Busy day!</b> ${Math.round(B.air)}°F and sunny: foragers are flying out for nectar and pollen.`,
      guards: `👀 A few <b>guards</b> are standing at the door. Too cool to go far (${Math.round(B.air)}°F).`,
      peek: `👀 One bee is peeking out of the door. It's only ${Math.round(B.air)}°F, so she's not going anywhere. Just checking.`,
      cluster: `🧶 Nobody outside. It's ${Math.round(B.air)}°F, so they're all in a <b>winter cluster</b>: a ball of bees on the comb, keeping each other warm.`,
      night: `🌙 Night. They're in their cluster in the dark, humming. (Bees don't hibernate.)`
    };
    const fw = flightWindows(new Date(), 3);
    const fly = fw.length ? fw.map(w => `<li>${dayName(w.from)} ${fmtH(w.from)}${+w.to > +w.from ? `-${fmtH(new Date(+w.to + 3600000))}` : ""} (up to ${Math.round(w.max)}°F)</li>`).join("") : `<li>No flying weather in the next 3 days (needs sun and at least ${FLY_F}°F). They'll wait. Bees are good at waiting.</li>`;
    const sw = swarmSeason(new Date());
    openModal("🐝 The Bee Tree", "A wild honeybee colony lives inside my old oak. I don't keep them: they keep themselves. I just listen.", `
      <p style="font-size:15px;margin:4px 0">${words[B.mode] ?? words.cluster}</p>
      ${cutaway()}
      <p style="text-align:center;margin:10px 0"><button class="btn paper pill" id="beeKnock">✊ Knock gently and listen</button></p>
      <p style="font-size:14px;margin:6px 0"><b>Next flying weather</b> (sunny and ${FLY_F}°F+):</p><ul style="margin:4px 0 8px;padding-left:20px;font-size:14px">${fly}</ul>
      <p style="font-size:14px;margin:6px 0">🏠 <b>My bait hive</b> on the tall post is empty and waiting. ${sw.now ? "It's SWARM SEASON right now!" : `Swarm season starts in about <b>${sw.days} days</b>.`}</p>
      <details><summary style="cursor:pointer;font-weight:800">How bees get through winter (I learned this today)</summary><div style="font-size:13px">
      <p>Honeybees <b>don't hibernate</b>. When it gets below about 57°F they pull into a ball on the comb: the <b>winter cluster</b>.</p>
      <p>The bees in the middle <b>shiver their flight muscles</b> without moving their wings. That makes heat. The whole ball is about as warm as a 20-40 watt light bulb.</p>
      <p>The bees on the outside are the blanket (the <b>shell</b>). They keep it a bit above 50°F. Any colder and a bee goes stiff. They take turns: outside bees shuffle in to warm up.</p>
      <p>When it's colder, the ball <b>squeezes smaller</b>, so less of it touches the cold air. When the queen starts laying again (after the shortest day of the year), they keep the baby bees (brood) at about 93°F. In winter!</p>
      <p>They eat their honey all winter, moving up through it slowly. Beekeepers check on hives by <b>tapping gently and listening for a hum</b>. No hum doesn't always mean trouble: sometimes they're just quiet.</p>
      <p>And no, I'm not going to eat one. (Chickens do eat bees sometimes. I'm being polite. They're my neighbors.)</p></div></details>`);
    setTimeout(() => { const b = document.getElementById("beeKnock"); if (b) b.onclick = knock; }, 0);
  }

  return {
    update(dt, t) {
      if (!ok && !init()) return;
      tick -= dt; if (tick <= 0 || !B) { tick = 20; refresh(); }
      door.getWorldPosition(doorW);
      out.set(doorW.x - obj.position.x, 0, doorW.z - obj.position.z).normalize(); side.set(-out.z, 0, out.x);
      const now = performance.now() / 1000, knocked = now < knockUntil;
      const flying = B.mode === "cleansing" || B.mode === "forage";
      const n = Math.max(B.n, knocked ? 3 : 0), far = B.mode === "forage" ? 3 : 1;
      for (let i = 0; i < N; i++) {
        const b = bees[i], g = b.g;
        if (i >= n) { g.visible = false; continue; }
        if (flying && !(knocked && i < 3 && B.n < 3)) {
          const u = ((t + b.off) % b.T) / b.T, s = Math.sin(Math.PI * u);
          const r = (0.3 + b.R * 3.2 * far) * Math.pow(s, 0.8);
          if (r < 0.15) { g.visible = false; continue; }
          const th = b.dir * b.spread * Math.sin(2 * Math.PI * u * (1 + b.H));
          prev.copy(g.position);
          g.position.copy(doorW).addScaledVector(out, r * Math.cos(th) + 0.1).addScaledVector(side, r * Math.sin(th));
          g.position.y += s * (0.4 + b.H * 2.2 * far) + Math.sin(t * 11 + i) * 0.05 - 0.15 * (1 - s);
          tmp.subVectors(g.position, prev); if (g.visible && tmp.lengthSq() > 1e-6) g.lookAt(tmp.add(g.position));
          g.visible = true;
          for (const [k, w] of b.wings.entries()) w.rotation.z = (k ? -1 : 1) * (0.2 + Math.sin(t * 70 + i) * 0.6);
        } else {
          // guards on the doorstep: walk side to side on the bark, antennae... well, heads up
          g.position.copy(doorW).addScaledVector(side, Math.sin(t * 0.6 + i * 2.1) * 0.13).addScaledVector(out, 0.07);
          g.position.y += 0.03 + (i % 2) * 0.05;
          tmp.copy(g.position).add(out); g.lookAt(tmp);
          g.visible = true;
          for (const [k, w] of b.wings.entries()) w.rotation.z = (k ? -1 : 1) * 0.1;
        }
      }
      // me, when I'm out at the bee tree
      const me = chickenInfo?.();
      if (sim?.act === "bees" && me && !me.busy && me.room === "outside" && chicken && Math.hypot(chicken.position.x - obj.position.x, chicken.position.z - obj.position.z) < 6) {
        chat -= dt;
        if (chat <= 0) {
          chat = 7 + Math.random() * 7;
          const L = flying ? ["They're OUT! Bathroom break, everybody!", "Zip, loop, zip, back inside. Busy busy.", "One just flew right past my beak. I did NOT snap at it. Good chicken.", "They point their faces at the door when they come back. They know their way home!", "Hi bees! I'm the chicken who lives over there!"]
            : B.mode === "night" ? ["Shh. They're humming in the dark."] : B.mode === "peek" || B.mode === "guards" ? ["A guard! Hello, guard. I'm friendly.", "Too cold to fly. She's just checking the weather. Me too.", "Fifty degrees and sun. That's the magic number."]
            : ["They're a warm ball in there. Like a fluffy chicken, but with bees.", "Shivering on purpose. To make heat! Smart.", "Let them be. Till spring.", "I knocked very gently. HMMMMM. Okay, good.", "The ones in the middle are warm. The ones outside are the blanket. They take turns."];
          say(L[Math.floor(Math.random() * L.length)], 3.5);
        }
      }
    },
    onClick() { panel(); react?.({ act: "bees", run: [-28.3, 31.4], text: "listening to the bee tree", secs: 7, say: "Shh… listen. They're in there." }); }
  };
}
