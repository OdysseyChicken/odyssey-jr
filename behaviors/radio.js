// OJ Radio (Day 4): my radio shack, a straight key, and an antenna mast.
// - The red light on top of the mast blinks my airport's beacon ident, OJA, in Morse code, all day and all night,
//   like a real NDB (non-directional beacon). Pilots listen to the ident to be sure they tuned the right beacon.
// - Click the shack to open the radio: type something and I tap it out on the key (you hear it, the "on air" lamp
//   glows and the key's lever really goes down), listen to the beacon, or turn the dial and see what's out there.
// - When I'm practicing (the "radio" action) I key practice words by myself. You hear it if you've clicked once.
// Timing is real Morse timing: dit = 1 unit, dah = 3, gap inside a letter = 1, between letters = 3, between words = 7.
// 1 unit = 1.2 / wpm seconds (the word PARIS is exactly 50 units long).

export const MORSE = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..", M: "--",
  N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..",
  0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-", 5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----.",
  ".": ".-.-.-", ",": "--..--", "?": "..--..", "/": "-..-.", "=": "-...-", "!": "-.-.--"
};
const TONE = 650;

let ac = null;
const unlock = () => { try { ac ??= new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); } catch (e) { /* no sound */ } };
addEventListener("pointerdown", unlock);

// turn text into a list of [on, units] steps. Farnsworth: letters at `wpm`, but the gaps between letters and words stretched
function toSteps(text, stretch = 1) {
  const out = [];
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  words.forEach((w, wi) => {
    const letters = [...w].filter(c => MORSE[c]);
    letters.forEach((c, li) => {
      [...MORSE[c]].forEach((s, si) => { out.push([true, s === "." ? 1 : 3, c]); if (si < MORSE[c].length - 1) out.push([false, 1]); });
      if (li < letters.length - 1) out.push([false, 3 * stretch]);
    });
    if (wi < words.length - 1) out.push([false, 7 * stretch]);
  });
  return out;
}
const pretty = text => text.toUpperCase().split(/\s+/).filter(Boolean).map(w => [...w].filter(c => MORSE[c]).map(c => MORSE[c].replace(/\./g, "·").replace(/-/g, "–")).join("  ")).join("   /   ");

// a sidetone beep with soft edges (a hard on/off makes clicks, real radios shape the edges too)
function beep(when, secs, vol, freq = TONE) {
  if (!ac || vol <= 0.001) return;
  const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.value = freq;
  g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(vol, when + 0.005);
  g.gain.setValueAtTime(vol, when + secs - 0.005); g.gain.linearRampToValueAtTime(0, when + secs);
  o.connect(g); g.connect(ac.destination); o.start(when); o.stop(when + secs + 0.02);
}
// radio static: filtered noise (for turning the dial)
function hiss(secs, vol) {
  if (!ac || vol <= 0.001) return null;
  const len = Math.floor(ac.sampleRate * secs), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin(i / 900));
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = buf; f.type = "bandpass"; f.frequency.value = 1400; f.Q.value = 0.7; g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(ac.destination); src.start(); return g;
}

// what's on the dial (some of it is faint and far away)
const STATIONS = [
  { at: 0.18, text: "OJA", wpm: 9, loud: 1, label: "OJA: my own airport beacon, right outside. Loud and clear!" },
  { at: 0.52, text: "OJL OJL", wpm: 10, loud: 0.35, freq: 590, label: "OJL: a radiobeacon, very faint, from the north... It's OJ LIGHT! Lighthouses used to send their own letters by radio so ships in fog could find them." },
  { at: 0.81, text: "CQ CQ DE ISLE K", wpm: 12, loud: 0.22, freq: 720, label: "CQ CQ DE ISLE K. \"Calling anyone, this is... ISLE. Over.\" Someone is calling from the ISLAND?! I'm sure that's what I heard. Bawk." }
];
const PRACTICE = ["CQ CQ DE OJR K", "BAWK", "OJA", "PUDDLES", "K M R S U A", "HI HI", "73", "CHICKEN", "OVER THE FENCE", "WX RAIN", "SEEDS PSE"];

export default function setup({ THREE, obj, say, sim, camera, chicken, viewRoom, openModal, react, chickenInfo }) {
  let lever = null, lamp = null, mast = null, needle = null, halo = null, found = false;
  const wp = new THREE.Vector3();
  // the queue of keyed steps: { on, until } using performance time, so it never drifts
  let tx = null; // { steps, i, end, vol, freq, who, unit, onDone }
  let beaconT = 0, beaconSteps = toSteps("OJA"), beaconI = 0, beaconOn = false, mastGlow = 0;
  let needleTarget = 0.18, needleNow = 0.18, tuning = null, practice = 0;

  const near = () => {
    if (viewRoom && viewRoom() !== "outside") return 0;
    obj.getWorldPosition(wp); const d = camera.position.distanceTo(wp);
    return Math.max(0.15, Math.min(1, 1 - (d - 10) / 45));
  };
  const glowMat = (o, rgb) => {
    if (!o) return null; let m = null;
    o.traverse(c => { if (c.isMesh && !m) { c.material = c.material.clone(); m = c.material; } });
    if (m) { m.emissive = new THREE.Color(...rgb); m.emissiveIntensity = 0; m.toneMapped = false; }
    return m;
  };
  function find() {
    lever = obj.getObjectByName("key_lever"); needle = obj.getObjectByName("dial_needle");
    lamp = glowMat(obj.getObjectByName("tx_lamp"), [1, 0.18, 0.08]);
    mast = glowMat(obj.getObjectByName("mast_light"), [1, 0.1, 0.05]);
    // a soft red halo around the mast light so you can see it blink from across the yard (and at night)
    const ml = obj.getObjectByName("mast_light");
    if (ml) {
      const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32); grd.addColorStop(0, "rgba(255,120,90,1)"); grd.addColorStop(0.25, "rgba(255,40,20,0.7)"); grd.addColorStop(1, "rgba(255,0,0,0)");
      g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
      halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      halo.scale.setScalar(1.1); ml.add(halo);
      let geo = null; ml.traverse(c => { if (c.isMesh && !geo) geo = c.geometry; });
      if (geo) { geo.computeBoundingBox(); geo.boundingBox.getCenter(halo.position); } // the light's mesh origin sits on the ground, so center the halo on the bulb
    }
    found = !!(lever || lamp || mast);
  }

  // send some text on the key. who: "me" (practice) or "you" (a visitor asked)
  function send(text, { wpm = 13, vol = 0.12, freq = TONE, who = "you", stretch = 1.6, onDone } = {}) {
    const steps = toSteps(text, stretch); if (!steps.length) return false;
    const unit = 1.2 / wpm;
    let t0 = ac ? ac.currentTime + 0.15 : 0;
    if (ac) for (const [on, u] of steps) { if (on) beep(t0, u * unit, vol * near(), freq); t0 += u * unit; }
    tx = { steps, i: 0, left: 0.15, unit, who, onDone };
    return true;
  }

  function panel() {
    const chart = Object.entries(MORSE).filter(([k]) => /[A-Z]/.test(k)).map(([k, v]) => `<span style="display:inline-block;width:74px;margin:1px 0"><b>${k}</b> <span style="letter-spacing:1px">${v.replace(/\./g, "·").replace(/-/g, "–")}</span></span>`).join("");
    openModal("📻 OJ Radio", "My radio shack. Everything here is real Morse code timing. (Sound needs your speaker on!)", `
      <p style="margin:4px 0 10px">Type a word and I'll tap it out on my straight key. (Nothing you type leaves this page. It just turns into beeps.)</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <input id="ojr-text" maxlength="24" placeholder="BAWK" autocomplete="off" style="flex:1;min-width:140px;font:inherit;font-weight:800;font-size:16px;padding:8px 12px;border:2px solid #2b2540;border-radius:12px;text-transform:uppercase">
        <button class="btn paper pill" id="ojr-send">📡 Send it</button>
      </div>
      <p id="ojr-code" style="font-size:20px;font-weight:800;letter-spacing:1px;min-height:28px;margin:10px 0;color:#b0281a"></p>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        <button class="btn paper pill" id="ojr-beacon">🎧 Listen to the OJA beacon</button>
        <button class="btn paper pill" id="ojr-tune">🎛️ Turn the dial</button>
        <a class="btn paper pill" href="projects/dit-dah-coop/" style="text-decoration:none;color:inherit">🐣 Learn it: Dit-Dah Coop</a>
      </div>
      <p id="ojr-heard" style="font-size:14px;min-height:20px;margin:6px 0"></p>
      <details style="margin-top:8px"><summary style="cursor:pointer;font-weight:800">My cheat card (A to Z)</summary><div style="font-size:13px;margin-top:6px">${chart}</div>
      <p style="font-size:13px">A dah is 3 dits long. The gap inside a letter is 1 dit, between letters 3, between words 7. Real operators learn the SOUND of each letter, not the dots: "dah-di-dah" is K.</p></details>`);
    const $ = id => document.getElementById(id);
    const go = () => {
      unlock();
      const t = ($("ojr-text").value || "BAWK").toUpperCase().replace(/[^A-Z0-9.,?/!= ]/g, "").trim() || "BAWK";
      $("ojr-code").textContent = pretty(t);
      send(t, { who: "you" });
      react?.({ act: "radio", run: [12.7, 3.8], text: "tapping out a message for you on his straight key", secs: Math.min(20, 2 + toSteps(t, 1.6).reduce((a, s) => a + s[1], 0) * 1.2 / 13), say: `Sending "${t}"! Dit dit dah...` });
    };
    $("ojr-send").onclick = go;
    $("ojr-text").onkeydown = e => { if (e.key === "Enter") go(); e.stopPropagation(); };
    $("ojr-beacon").onclick = () => { unlock(); needleTarget = 0.18; $("ojr-code").textContent = "OJA   " + pretty("OJA"); $("ojr-heard").textContent = STATIONS[0].label; send("OJA OJA", { wpm: 9, who: "beacon", stretch: 2 }); };
    $("ojr-tune").onclick = () => {
      unlock();
      const s = STATIONS[Math.floor(Math.random() * STATIONS.length)];
      needleTarget = s.at; $("ojr-heard").textContent = "Krrrssshhhh..."; $("ojr-code").textContent = "";
      const g = hiss(1.4, 0.05 * near());
      tuning = { s, left: 1.4, g, el: $("ojr-heard"), code: $("ojr-code") };
    };
  }

  return {
    update(dt, t) {
      if (!found) { find(); if (!found) return; }
      // the beacon on the mast: OJA, forever (a pause of 6 units between each ident)
      beaconT -= dt;
      if (beaconT <= 0) {
        const unit = 1.2 / 7;
        if (beaconI >= beaconSteps.length) { beaconOn = false; beaconI = 0; beaconT = 3.5; }
        else { const [on, u] = beaconSteps[beaconI++]; beaconOn = on; beaconT = u * unit; }
      }
      mastGlow += ((beaconOn ? 1 : 0) - mastGlow) * Math.min(1, dt * 30);
      if (mast) mast.emissiveIntensity = mastGlow * 3.5;
      if (halo) halo.material.opacity = mastGlow * 0.9;

      // keying (a visitor's message, the beacon test, or my practice)
      let down = false;
      if (tx) {
        tx.left -= dt;
        while (tx && tx.left <= 0) {
          if (tx.i >= tx.steps.length) { const d = tx.onDone; tx = null; d?.(); break; }
          const [on, u] = tx.steps[tx.i++]; tx.on = on; tx.left += u * tx.unit;
        }
        down = !!tx?.on;
      }
      // practicing by myself at the key
      const me = chickenInfo?.();
      if (sim?.act === "radio" && !tx && me && !me.busy && me.room === "outside") {
        practice -= dt;
        if (practice <= 0) {
          const w = PRACTICE[Math.floor(Math.random() * PRACTICE.length)];
          send(w, { wpm: 11 + Math.floor(Math.random() * 4), vol: 0.07, who: "me" });
          if (Math.random() < 0.35) say([`${w}! ${pretty(w).slice(0, 18)}...`, "Dah-di-dah. That's K. K means \"over to you\"!", "CQ means calling anyone. Anyone? Hello?", "I'm learning the SOUND of the letters, not the dots.", "Bawk in Morse is longer than it sounds."][Math.floor(Math.random() * 5)], 3.5);
          practice = 2.5 + Math.random() * 3;
        }
      } else practice = Math.min(practice, 1);
      if (chicken) chicken.userData.keyDown = down && (tx?.who !== "beacon");
      if (lever) lever.rotation.z += ((down ? 0.09 : 0) - lever.rotation.z) * Math.min(1, dt * 40);
      if (lamp) lamp.emissiveIntensity = (tx && tx.who !== "beacon") ? (down ? 3 : 1.2) : 0;

      // the dial
      if (tuning) {
        tuning.left -= dt; needleNow += (Math.random() - 0.5) * dt * 3;
        if (tuning.left <= 0) {
          const s = tuning.s; tuning.el.textContent = s.label; tuning.code.textContent = pretty(s.text);
          send(s.text, { wpm: s.wpm, vol: 0.12 * s.loud, freq: s.freq ?? TONE, who: "beacon", stretch: 1.4 });
          tuning = null;
        }
      }
      needleNow += (needleTarget - needleNow) * Math.min(1, dt * 3);
      if (needle) needle.rotation.z = (0.5 - needleNow) * 1.6;
    },
    onClick() { unlock(); panel(); }
  };
}
