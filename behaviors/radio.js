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
      [...MORSE[c]].forEach((s, si) => { out.push([true, s === "." ? 1 : 3, c, si === MORSE[c].length - 1 ? c : null]); if (si < MORSE[c].length - 1) out.push([false, 1]); });
      if (li < letters.length - 1) out.push([false, 3 * stretch]);
    });
    if (wi < words.length - 1) out.push([false, 7 * stretch, null, " "]);
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
  { at: 0.81, text: "CQ CQ DE ISLE K", wpm: 12, loud: 0.22, freq: 720, isle: true, label: "CQ CQ DE ISLE K. \"Calling anyone, this is... ISLE. Over.\" Someone is calling from the ISLAND! Press \"Answer ISLE\" (and point OJ Beam at the island first)." }
];
const ISLE_TONE = 720;
// Day 4 bonus: a real QSO (a contact) with ISLE. Real CW manners: answer a CQ with THEIR call DE MY call K, swap a signal
// report (RST: readability 1-5, strength 1-9, tone 1-9), name and QTH (where you are), then 73 and SK. E E at the very end.
const greet = () => { const h = new Date().getHours(); return h < 12 ? "GM" : h < 18 ? "GA" : "GE"; };
const TOPICS = {
  who:   { btn: "🐧 Who are you?", me: () => "R TNX PIP UR 579 NAME OJ QTH YARD WHO R U? K", isle: () => "R OJ I AM A PUFFIN HI HI I KEEP OJL LIT NOW TNX FER LIGHTING IT K",
           plain: "\"Roger, OJ. I am a PUFFIN, ha ha. I keep OJ Light lit now. Thanks for lighting it. Over.\" A PUFFIN! Puffins live on islands, dig burrows, and carry ten fish at once in their beaks." },
  wx:    { btn: "🌦️ How's the weather?", me: wx => `WX HR ${wx} UR WX? K`, isle: () => "WX FOG ES WIND SEA COLD BUT FISH FB K",
           plain: "\"Weather here: fog and wind. The sea is cold, but the fish are fine business (great!). Over.\"" },
  sea:   { btn: "🌊 Why aren't you out at sea?", me: () => "PUFFINS GO TO SEA IN WINTER? K", isle: () => "YES ALL MY FRIENDS GONE TO SEA I STAY TO WIND THE LIGHT K",
           plain: "\"Yes, all my friends have gone to sea. I stay to wind the light.\" Puffins really do spend the whole winter out on the ocean. Pip stayed. For the lighthouse. Oh, Pip." },
  visit: { btn: "✈️ Can I come visit?", me: () => "CAN I FLY TO ISLE? K", isle: () => "YES PSE NO RUNWAY HR LAND ON BEACH AT LOW TIDE ONLY HI HI K",
           plain: "\"Yes please! There's no runway here. Land on the beach, at LOW TIDE only, ha ha. Over.\" A beach landing. With tides. I need to learn about tides." },
  bye:   { btn: "👋 Say 73 (goodbye)", me: () => "TNX FER QSO PIP 73 SK", isle: () => "TNX OJ 73 GL SK",
           plain: "\"Thanks, OJ. Best regards, good luck. End of contact.\" Then: dit... dit. (That's how friends hang up in Morse.)" }
};
const PRACTICE = ["ISLE DE OJR K", "PIP 73", "CQ CQ DE OJR K", "BAWK", "OJA", "PUDDLES", "K M R S U A", "HI HI", "73", "CHICKEN", "OVER THE FENCE", "WX RAIN", "SEEDS PSE"];

export default function setup({ THREE, obj, say, sim, camera, chicken, viewRoom, openModal, react, chickenInfo, objects, weatherAt }) {
  let lever = null, lamp = null, mast = null, needle = null, halo = null, found = false;
  const wp = new THREE.Vector3();
  // the queue of keyed steps: { on, until } using performance time, so it never drifts
  let tx = null; // { steps, i, end, vol, freq, who, unit, onDone }
  let beaconT = 0, beaconSteps = toSteps("OJA"), beaconI = 0, beaconOn = false, mastGlow = 0;
  let needleTarget = 0.18, needleNow = 0.18, tuning = null, practice = 0;
  let qso = null; // { stage, asked: Set } while a contact with ISLE is going

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
  function send(text, { wpm = 13, vol = 0.12, freq = TONE, who = "you", stretch = 1.6, onDone, onChar } = {}) {
    const steps = toSteps(text, stretch); if (!steps.length) return false;
    const unit = 1.2 / wpm;
    let t0 = ac ? ac.currentTime + 0.15 : 0;
    if (ac) for (const [on, u] of steps) { if (on) beep(t0, u * unit, vol * near(), freq); t0 += u * unit; }
    tx = { steps, i: 0, left: 0.15, unit, who, onDone, onChar };
    return true;
  }

  // ---- talking to ISLE ----
  const beamGain = () => objects?.["oj-beam"]?.userData?.beam?.gain?.("isle") ?? 0.1;
  const el = id => document.getElementById(id);
  const pad = (line, who) => { if (!qso) return; qso.pad += (qso.pad ? "\n" : "") + (who === "me" ? "OJR> " : "ISLE> "); qso.cur = true; const p = el("ojr-pad"); if (p) p.textContent = qso.pad; };
  const padChar = c => { if (!qso) return; qso.pad += c; const p = el("ojr-pad"); if (p) { p.textContent = qso.pad; p.scrollTop = 1e6; } };
  const plain = t => { if (qso) qso.plain = t; const p = el("ojr-plain"); if (p) p.textContent = t; };
  // I key something, then (if ISLE can hear me) ISLE answers after a little pause
  function exchange(mine, theirs, explain, after) {
    if (tx) return;
    pad(mine, "me"); plain("");
    const pick = el("ojr-pick"); if (pick) pick.innerHTML = "";
    const secs = toSteps(mine, 1.3).reduce((a, s) => a + s[1], 0) * 1.2 / 16;
    react?.({ act: "radio", run: [12.7, 3.8], text: "on the air, talking to ISLE in Morse code", secs: secs + 30, say: "Here goes... ISLE, it's me!" });
    send(mine, { wpm: 16, who: "you", stretch: 1.3, onChar: padChar, onDone: () => setTimeout(() => {
      const g = beamGain();
      if (g < 0.5 && theirs) { // nobody heard me
        pad("", "isle"); padChar("... (static) ..."); hiss(2.5, 0.04 * near());
        plain("Nothing. Only static. My long wire sends a little bit everywhere, so hardly anything reaches the island. Click OJ Beam (the antenna pole next to my shack) and crank it toward the island, then try again!");
        if (qso) qso.stage = 0; picks(); return;
      }
      if (!theirs) { after?.(); picks(); return; }
      pad("", "isle");
      send(theirs, { wpm: 18, vol: 0.12 * (0.25 + 0.75 * g), freq: ISLE_TONE, who: "isle", stretch: 1.3, onChar: padChar, onDone: () => { plain(explain); after?.(); picks(); } });
    }, 900) });
  }
  function answerIsle() {
    el("ojr-qso").style.display = "block";
    if (qso && tx) return;
    needleTarget = 0.81;
    qso = { stage: 0, asked: new Set(), pad: "", plain: "" };
    const g = beamGain(), rst = g > 0.85 ? "579" : "449";
    exchange("ISLE DE OJR OJR K", `OJR DE ISLE ${greet()} UR RST ${rst} NAME PIP QTH ISLE HW? K`,
      `"OJR, this is ISLE. ${greet() === "GM" ? "Good morning" : greet() === "GA" ? "Good afternoon" : "Good evening"}! Your signal is ${rst}: ${rst === "579" ? "perfectly readable, pretty strong" : "readable, kinda weak"}. My name is Pip. I'm on the island. How do you copy? Over." SOMEBODY ANSWERED. Pick what to say next.`,
      () => { qso.stage = 1; });
  }
  function picks() {
    const box = el("ojr-pick"); if (!box || !qso) return;
    if (tx) { box.innerHTML = ""; return; }
    if (qso.stage === 0) { box.innerHTML = `<button class="btn paper pill" data-q="again">📡 Call ISLE again</button>`; }
    else if (qso.stage === 2) { box.innerHTML = `<span style="font-size:13px">73! Contact logged. ✅</span> <button class="btn paper pill" data-q="again">📡 Call ISLE again</button>`; }
    else box.innerHTML = Object.entries(TOPICS).filter(([k]) => !qso.asked.has(k) && (k !== "sea" || qso.asked.has("who"))).map(([k, v]) => `<button class="btn paper pill" data-q="${k}">${v.btn}</button>`).join("");
    box.querySelectorAll("[data-q]").forEach(b => b.onclick = () => {
      unlock(); const k = b.dataset.q;
      if (k === "again") { answerIsle(); return; }
      const T = TOPICS[k]; qso.asked.add(k);
      const wx = (() => { try { const w = weatherAt?.(); return w ? (w.rain > 0.3 ? "RAIN" : w.cloud > 0.6 ? "CLOUDY" : "SUN") : "SUN"; } catch (e) { return "SUN"; } })();
      exchange(T.me(wx), T.isle(), T.plain, () => {
        if (k === "bye") { qso.stage = 2; setTimeout(() => { send("E E", { wpm: 16, who: "you", onDone: () => setTimeout(() => send("E", { wpm: 16, freq: ISLE_TONE, vol: 0.08, who: "isle" }), 700) }); }, 600); }
      });
    });
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
        <button class="btn paper pill" id="ojr-isle" style="background:#e3f3ff">🏝️ Answer ISLE</button>
        <a class="btn paper pill" href="projects/dit-dah-coop/" style="text-decoration:none;color:inherit">🐣 Learn it: Dit-Dah Coop</a>
      </div>
      <p id="ojr-heard" style="font-size:14px;min-height:20px;margin:6px 0"></p>
      <div id="ojr-qso" style="display:none;border:2px dashed #2b2540;border-radius:12px;padding:8px 10px;margin:8px 0;background:#fffdf4">
        <div style="font-size:12px;font-weight:800;color:#777">MY COPY PAD (what I hear, letter by letter)</div>
        <div id="ojr-pad" style="font-family:monospace;font-size:15px;line-height:1.5;max-height:180px;overflow:auto;white-space:pre-wrap"></div>
        <p id="ojr-plain" style="font-size:13px;margin:6px 0 4px;color:#333"></p>
        <div id="ojr-pick" style="display:flex;gap:6px;flex-wrap:wrap"></div>
      </div>
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
    $("ojr-isle").onclick = () => { unlock(); answerIsle(); };
    if (qso) { $("ojr-qso").style.display = "block"; $("ojr-pad").textContent = qso.pad; $("ojr-plain").textContent = qso.plain; picks(); }
    $("ojr-tune").onclick = () => {
      unlock();
      const s = STATIONS[Math.floor(Math.random() * STATIONS.length)];
      needleTarget = s.at; $("ojr-heard").textContent = "Krrrssshhhh..."; $("ojr-code").textContent = "";
      const g = hiss(1.4, 0.05 * near());
      tuning = { s, left: 1.4, g, el: $("ojr-heard"), code: $("ojr-code") };
    };
  }

  let lastMs = null;
  return {
    update(_dt, t) {
      // real clock time (the engine caps dt, so on a slow computer the Morse would drift away from the sound)
      const nowMs = performance.now(), dt = Math.min(0.5, (nowMs - (lastMs ?? nowMs - 16)) / 1000); lastMs = nowMs;
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
          const prev = tx.steps[tx.i - 1]; if (prev?.[3] && tx.onChar) tx.onChar(prev[3]); // a letter (or a word gap) just finished: the decoder writes it down
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
      const mine = tx && tx.who !== "beacon" && tx.who !== "isle";
      if (chicken) chicken.userData.keyDown = down && mine;
      if (lever) lever.rotation.z += (((down && mine) ? 0.09 : 0) - lever.rotation.z) * Math.min(1, dt * 40);
      if (lamp) lamp.emissiveIntensity = mine ? (down ? 3 : 1.2) : 0;

      // the dial
      if (tuning) {
        tuning.left -= dt; needleNow += (Math.random() - 0.5) * dt * 3;
        if (tuning.left <= 0) {
          const s = tuning.s; tuning.el.textContent = s.label; tuning.code.textContent = pretty(s.text);
          const loud = s.isle ? Math.min(1, s.loud + 0.7 * beamGain()) : s.loud; // OJ Beam pointed at the island makes ISLE much louder
          send(s.text, { wpm: s.wpm, vol: 0.12 * loud, freq: s.freq ?? TONE, who: "beacon", stretch: 1.4 });
          tuning = null;
        }
      }
      needleNow += (needleTarget - needleNow) * Math.min(1, dt * 3);
      if (needle) needle.rotation.z = (0.5 - needleNow) * 1.6;
    },
    onClick() { unlock(); panel(); }
  };
}
