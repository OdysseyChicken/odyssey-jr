// OJ Music (Day 3, bonus 2): the Cluck-a-phone and the wind chime.
// - Click a colored bar to play that note. Click anywhere else on it (or the sign) to hear my song, "Over the Fence".
// - The wind chime swings and rings with the real yard wind from OJ Weather (more wind = more rings).
// - When I'm practicing (the "music" action), the bars bounce under my beak, and you hear it if you've clicked once.
// Sounds are made right here with WebAudio. Browsers only allow sound after you click something.
const NOTES = [523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 987.77, 1046.5]; // C major, C5..C6 (bar0 = lowest, longest)
const CHIME = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];                // C pentatonic: no notes can clash
// my song. [bar, beats]; bar -1 = rest
const SONG = [[2, 1], [4, 1], [7, 2], [6, 1], [4, 1], [5, 2], [4, 1], [2, 1], [1, 1], [2, 1], [0, 3], [-1, 1],
  [0, 1], [2, 1], [4, 1], [5, 1], [7, 1], [5, 1], [4, 2], [3, 1], [2, 1], [1, 1], [3, 1], [2, 1], [1, 1], [0, 3], [-1, 2]];
const BEAT = 0.24;

let ac = null;
const unlock = () => { try { ac ??= new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); } catch (e) { /* no sound */ } };
addEventListener("pointerdown", unlock);

// a wooden bar: the arch under a xylophone bar tunes its first overtone to 3x the note, so it sounds bright and clean
function xylo(f, vol) {
  if (!ac || vol <= 0.001) return;
  const t = ac.currentTime, out = ac.createGain(); out.gain.value = vol; out.connect(ac.destination);
  for (const [mul, amp, dec] of [[1, 1, 0.55], [3, 0.35, 0.18], [9.2, 0.08, 0.04]]) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.value = f * mul;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dec + 0.05);
  }
}
// a metal tube is a "free bar": its overtones are NOT whole-number multiples (2.76x, 5.40x, 8.93x), that's the shimmery chime sound
function chime(f, vol) {
  if (!ac || vol <= 0.001) return;
  const t = ac.currentTime, out = ac.createGain(); out.gain.value = vol; out.connect(ac.destination);
  for (const [mul, amp, dec] of [[1, 1, 3.2], [2.756, 0.45, 1.6], [5.404, 0.2, 0.8], [8.933, 0.07, 0.35]]) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.value = f * mul;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dec + 0.05);
  }
}

export default function setup({ THREE, obj, say, sim, camera, weatherAt, viewRoom }) {
  let bars = null, swing = null, tubes = [], striker = null;
  const bounce = new Array(8).fill(0);
  const tube = []; // pendulum per tube: angle a, speed v
  let pa = 0, pv = 0, sa = 0, sv = 0, song = null, practice = null, ptr = { x: 0, y: 0 };
  addEventListener("pointerdown", e => { ptr = { x: e.clientX, y: e.clientY }; });
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), wp = new THREE.Vector3();

  const near = () => { // quieter when you're far away, silent when you're inside a room
    if (viewRoom && viewRoom() !== "outside") return 0;
    obj.getWorldPosition(wp); const d = camera.position.distanceTo(wp);
    return Math.max(0, Math.min(1, 1 - (d - 12) / 40));
  };
  const hit = (i, loud = 1) => { bounce[i] = 1; xylo(NOTES[i], 0.16 * loud * near()); };
  const ring = (i, loud = 1) => { if (tube[i]) tube[i].v += 1.6 * (Math.random() < 0.5 ? -1 : 1); chime(CHIME[i], 0.05 * loud * near()); };

  function find() {
    bars = []; for (let i = 0; i < 8; i++) bars.push(obj.getObjectByName("bar" + i));
    if (bars.some(b => !b)) { bars = null; return; }
    bars.forEach(b => b.userData.y0 = b.position.y);
    swing = obj.getObjectByName("chimes"); striker = obj.getObjectByName("striker");
    for (let i = 0; i < 6; i++) { tubes.push(obj.getObjectByName("chime" + i)); tube.push({ a: 0, v: 0 }); }
  }
  function playSong(by) {
    song = { i: 0, t: 0, by };
  }

  return {
    update(dt, t) {
      if (!bars) { find(); if (!bars) return; }
      // song playback (a visitor asked for it)
      if (song) {
        song.t -= dt;
        if (song.t <= 0) {
          const n = SONG[song.i++];
          if (!n) { song = null; } else { if (n[0] >= 0) hit(n[0]); song.t += n[1] * BEAT; }
        }
      }
      // me practicing: I play my song (and sometimes a wrong note, then I try again)
      if (sim?.act === "music" && !song) {
        practice ??= { i: 0, t: 1 };
        practice.t -= dt;
        if (practice.t <= 0) {
          const n = SONG[practice.i % SONG.length]; practice.i++;
          if (n[0] >= 0) {
            const oops = Math.random() < 0.04;
            hit(oops ? Math.floor(Math.random() * 8) : n[0], 0.6);
            if (oops) { say(["Oops. Wrong bar.", "Hmm, that wasn't it…", "Bawk! Again from the top."][Math.floor(Math.random() * 3)], 2.5); practice.i = 0; practice.t = 1.2; return; }
          }
          practice.t = n[1] * BEAT * 1.15;
        }
      } else if (sim?.act !== "music") practice = null;
      bars.forEach((b, i) => { bounce[i] = Math.max(0, bounce[i] - dt * 5); b.position.y = b.userData.y0 + Math.sin(bounce[i] * Math.PI) * 0.04 * bounce[i]; });

      // the wind chime reads the same wind as my windsock and rooster vane
      const w = weatherAt ? weatherAt(new Date()) : { wind: 0.3, dir: 0 };
      const wind = w.wind ?? 0.3, gust = wind * (0.7 + 0.3 * Math.sin(t * 0.9) * Math.sin(t * 0.37 + 2));
      pv += (-pa * 3 - pv * 0.8 + (Math.random() - 0.5) * gust * 6) * dt; pa += pv * dt;
      sv += (-sa * 4 - sv * 0.6 + (Math.random() - 0.5) * gust * 14) * dt; sa += sv * dt;
      if (swing) { swing.rotation.x = pa * 0.5 + gust * 0.08; swing.rotation.z = Math.sin(t * 0.6) * pa * 0.4; }
      if (striker) { striker.rotation.x = sa * 0.6 + gust * 0.25; striker.rotation.z = Math.sin(t * 1.3) * sa * 0.5; }
      tube.forEach((q, i) => {
        q.v += (-q.a * 9 - q.v * 0.9 + (Math.random() - 0.5) * gust * 4) * dt; q.a += q.v * dt;
        if (tubes[i]) { tubes[i].rotation.x = q.a * 0.25; tubes[i].rotation.z = q.a * 0.15 * Math.cos(i); }
      });
      // rings: almost never when calm, lots when it's gusty
      if (Math.random() < dt * (0.03 + gust * gust * 2.2)) ring(Math.floor(Math.random() * 6), 0.6 + gust * 0.6);
    },
    onClick() {
      unlock();
      // which part did you click?
      ndc.set(ptr.x / innerWidth * 2 - 1, -(ptr.y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
      if (bars) {
        const hb = ray.intersectObjects(bars, true)[0];
        if (hb) { let o = hb.object; while (o && !bars.includes(o)) o = o.parent; const i = bars.indexOf(o); if (i >= 0) { hit(i); return; } }
        const ht = ray.intersectObjects(tubes.filter(Boolean), true)[0];
        if (ht) { let o = ht.object; while (o && !tubes.includes(o)) o = o.parent; const i = tubes.indexOf(o); if (i >= 0) { ring(i, 1.4); say("Ting! That tube is " + ["C", "D", "E", "G", "A", "high C"][i] + ". All my chimes are from the pentatonic scale, so they never sound bad together.", 4); return; } }
      }
      if (song) { say("Shh, I'm in the middle of it! ♪", 2); return; }
      say("This is my song. It's called \"Over the Fence\". ♪ (Tip: click a colored bar to play it yourself!)", 5);
      playSong("visitor");
    }
  };
}
