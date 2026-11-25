// OJ Turkeys (Day 13). My wild cousins! Six wild turkeys live in the east field: Big Hazel (the boss hen), her daughters,
// two more hens, and Rusty, this year's jake, who struts at EVERYONE. They sleep in the Roost (a big bare old white oak),
// fly down at dawn, walk the same loop every day to the acorn oak, scratch, and fly back up at sunset (world/turkeys.js).
// This script lives on Rusty and moves the whole flock (the hens are their own objects: turkey-hen-1..5).
import { FLOCK, ROOST, FEED, ROUTE_LEN, routeAt, turkeysAt, dayPlan, wob } from "../world/turkeys.js";
import { trainAt } from "../world/rail.js";
import { timeStr } from "../world/balloon.js";
import { critters, stats, chirp, panFor, volFor, makeTag } from "./oak-life.js";

export const tstats = { gobbles: 0, struts: 0, patches: 0, putts: 0 };

export default function setup({ THREE, obj, scene, say, chicken, camera, controls, setFollow, objects, chickenInfo, openModal }) {
  const tree = () => objects["oj-roost"];
  const birds = FLOCK.map((f, i) => ({ ...f, i, obj: i === 0 ? obj : objects[f.id], parts: null, pos: null, dir: 0, anim: "stand", strut: 0, tag: makeTag(), speedNow: 0, sound: 0 }));
  for (const b of birds) critters.push({ id: b.id, name: `${b.name} the wild turkey`, kind: "turkey", obj: b.obj, visible: () => !!b.obj?.visible });
  const order = [3, 0, 1, 4, 2, 5];        // walking order along the route: Hazel leads, Rusty in the middle, Pepper last
  const perchW = [], tmp = new THREE.Vector3(), up = new THREE.Vector3();
  let ready = false, lastTrain = trainAt().stage, lastHoots = stats.hoots, gobbleIn = 20, yelpIn = 6, putCool = 0, saidHi = "", t = 0;
  const today = () => new Date().toDateString();

  // ---------- sounds (made from little chirps, like all my critters) ----------
  const where = b => ({ pan: panFor(camera, b.obj.position), vol: volFor(camera, b.obj.position, 1) });
  function gobble(b, why = "") {
    const { pan, vol } = where(b);
    // a gobble is a fast rattly warble that drops in pitch: gil-obble-obble-obble
    for (let k = 0; k < 14; k++) { const f = 1050 - k * 32 + (k % 2 ? -180 : 120); chirp({ a: f, b: f * 0.8, secs: 0.07, at: k * 0.06, vol: vol * 0.16, type: "sawtooth", band: 1100, q: 1.6, pan }); }
    b.tag.speak("GOBBLE-obble-obble!" + why, 2.6); b.sound = 1.0; tstats.gobbles++;
  }
  function yelp(b, n = 3, soft = false) {
    const { pan, vol } = where(b);
    for (let k = 0; k < n; k++) { chirp({ a: 980, b: 860, secs: 0.09, at: k * 0.42, vol: vol * (soft ? 0.05 : 0.1), type: "sawtooth", band: 950, q: 2, pan }); chirp({ a: 640, b: 520, secs: 0.16, at: k * 0.42 + 0.1, vol: vol * (soft ? 0.06 : 0.12), type: "sawtooth", band: 700, q: 2, pan }); }
    b.tag.speak(soft ? "(yee-yauk… yee-yauk…)" : "YEE-YAUK yee-yauk yauk", 2); b.sound = 0.5;
  }
  function putt(b) { const { pan, vol } = where(b); chirp({ a: 1500, b: 1100, secs: 0.05, vol: vol * 0.2, type: "square", band: 1400, q: 3, pan }); b.tag.speak("PUTT!", 1.6); tstats.putts++; }
  function purr(b) { const { pan, vol } = where(b); for (let k = 0; k < 20; k++) chirp({ a: 560, b: 500, secs: 0.03, at: k * 0.04, vol: vol * 0.05, type: "triangle", band: 600, q: 1.5, pan }); b.tag.speak("(prrrrrr… cluck)", 2.2); }
  function spitDrum(b) {
    const { pan, vol } = where(b);
    chirp({ a: 2600, b: 500, secs: 0.07, vol: vol * 0.12, type: "square", band: 2200, q: 0.8, pan }); // "pfft" (the spit)
    for (let k = 0; k < 14; k++) chirp({ a: 70, b: 52, secs: 0.12, at: 0.25 + k * 0.07, vol: vol * 0.35 * (1 - k / 16), type: "sine", band: 80, q: 0.5, pan }); // vrrrrummmm (the drum, low and quiet)
    b.tag.speak("pfft… vrrrummmm", 2.2);
  }

  // ---------- scratched patches in the leaves ----------
  const patchMat = new THREE.MeshStandardMaterial({ color: "#6e4a2c", roughness: 1, transparent: true, opacity: 0.85, depthWrite: false });
  const patches = [];
  function scratchPatch(x, z) {
    if (patches.length > 60) { const p = patches.shift(); scene.remove(p.m); p.m.geometry.dispose(); }
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.3 + Math.random() * 0.25, 10), patchMat.clone());
    m.rotation.x = -Math.PI / 2; m.position.set(x + (Math.random() - 0.5) * 0.3, 0.025, z + (Math.random() - 0.5) * 0.3); m.scale.set(1, 0.7 + Math.random() * 0.5, 1);
    scene.add(m); patches.push({ m, age: 0 }); tstats.patches++;
  }

  // ---------- where each bird should be right now ----------
  function groundSpot(b, now, center, rad) {
    const a = b.i * 1.047 + wob(now, b.i, 0.6) * 0.42, r = rad * (0.45 + 0.35 * (wob(now, b.i + 9, 0.8) + 1) / 2);
    return [center[0] + Math.cos(a) * r, center[1] + Math.sin(a) * r];
  }
  const UNDER = [ROOST[0] + 2.5, ROOST[1] + 2.4];  // the clearing on the sunny side of the Roost (away from the railway)
  function plan(b, T, now) {
    const p = T, i = b.i;
    const dn = p.down(i).getTime(), upT = p.up(i).getTime();
    if (now < dn && (p.stage === "roost" && now < p.outStart || p.stage === "treetalk" || p.stage === "flydown")) return { mode: "perch" };
    if (now >= dn && now < dn + 4000) return { mode: "flydown", k: (now - dn) / 4000, to: groundSpot(b, now, UNDER, 3.2) };
    if (now >= upT && now < upT + 3500) return { mode: "flyup", k: (now - upT) / 3500, from: groundSpot(b, upT, UNDER, 3.2) };
    if (now >= upT + 3500 || p.stage === "roost") return { mode: "perch" };
    if (p.stage === "out" || p.stage === "back") {
      const r = routeAt(p.stage === "out" ? p.s * ROUTE_LEN - order[i] * 1.7 : p.s * ROUTE_LEN + order[i] * 1.7);
      const side = wob(now, i, 1.3) * 0.9;
      return { mode: "ground", at: [r.x + Math.cos(r.dir) * side, r.z - Math.sin(r.dir) * side] };
    }
    if (p.stage === "feed") return { mode: "ground", at: groundSpot(b, now, FEED, 3.4) };
    return { mode: "ground", at: groundSpot(b, now, UNDER, 3.2) };
  }
  const perchPos = i => perchW[i] ?? new THREE.Vector3(ROOST[0], 4, ROOST[1]);

  function initParts(b) {
    const o = b.obj; if (!o || !o.children.length) return false;
    const g = n => o.getObjectByName(n);
    b.parts = { head: g("tk_head"), fan: g("tk_fan"), wl: g("tk_wing_l"), wr: g("tk_wing_r"), snood: g("tk_snood"), skin: [], crown: [] };
    o.rotation.order = "YXZ";
    if (b.kind === "jake") o.traverse(n => {
      if (!n.isMesh) return;
      if (n.material?.name === "tk_skin") { n.material = b.parts.skinMat ??= n.material.clone(); }
      if (n.material?.name === "tk_crown") { n.material = b.parts.crownMat ??= n.material.clone(); }
    });
    if (b.kind === "jake") { const bd = g("tk_beard"); if (bd) bd.scale.set(0.6, 0.6, 0.45); } // a jake's beard is just a little tuft
    return !!b.parts.head;
  }

  const red = new THREE.Color("#d21c18"), white = new THREE.Color("#f2f2f5"), blue = new THREE.Color("#6f8fd6"), pink = new THREE.Color("#c86a64");

  // point the camera at the flock (from the modal button)
  function lookAtFlock(dist = 1) {
    const c = new THREE.Vector3(); for (const b of birds) c.add(b.obj.position); c.divideScalar(birds.length);
    setFollow?.(false); controls.target.set(c.x, Math.max(1, c.y * 0.8), c.z);
    camera.position.set(c.x - 8 * dist, c.y + 5 * dist, c.z + 8 * dist); controls.update();
  }
  document.addEventListener("click", e => { if (e.target?.id === "tkLook") { document.getElementById("modal")?.classList.remove("open"); lookAtFlock(); } });
  window.__ojTurkeys = { showFlock, lookAtFlock, tstats, birds };

  return {
    update(dt, tt) {
      t = tt;
      if (!ready) {
        if (!tree()?.children.length) return;
        for (const b of birds) if (!b.parts && !initParts(b)) return;
        tree().updateMatrixWorld(true);
        for (let i = 0; i < birds.length; i++) { const e = tree().getObjectByName(`perch_${i}`); perchW[i] = e ? e.getWorldPosition(new THREE.Vector3()) : null; }
        ready = true;
      }
      const nowD = new Date(), now = nowD.getTime(), T = turkeysAt(nowD);
      const me = chickenInfo(), mePos = chicken.position;

      for (const b of birds) {
        const o = b.obj, P = b.parts, pl = plan(b, T, now);
        let anim = "stand", y = 0, wingFlap = 0;
        if (pl.mode === "perch") {
          const pp = perchPos(b.i); o.position.copy(pp); y = pp.y - 0.55 * (b.kind === "jake" ? 0.9 : 0.8);
          b.dir = Math.atan2(pp.x - ROOST[0], pp.z - ROOST[1]); anim = T.stage === "roost" ? "sleep" : "perchawake"; b.pos = null;
        } else if (pl.mode === "flydown" || pl.mode === "flyup") {
          const pp = perchPos(b.i), g = new THREE.Vector3(...(pl.mode === "flydown" ? [pl.to[0], 0, pl.to[1]] : [pl.from[0], 0, pl.from[1]]));
          const a = pl.mode === "flydown" ? pp : g, z = pl.mode === "flydown" ? g : pp, k = pl.k;
          const e = pl.mode === "flydown" ? k * k * (3 - 2 * k) : Math.sqrt(k);
          o.position.lerpVectors(a, z, e); y = o.position.y + Math.sin(Math.PI * k) * (pl.mode === "flydown" ? 1.2 : 0.6);
          b.dir = Math.atan2(z.x - a.x, z.z - a.z); anim = "fly"; wingFlap = 1; b.pos = null;
          if (pl.mode === "flydown" && k > 0.92 && !b.landed) { b.landed = true; b.tag.speak(["*FLUMP*", "*crash* (oof)", "*thud* …nailed it", "*whump*"][b.i % 4], 1.6); }
          if (pl.mode === "flyup") b.landed = false;
          if (pl.mode === "flyup" && k < 0.05 && !b.flapSaid) { b.flapSaid = true; b.tag.speak("*WHUP WHUP WHUP*", 1.4); }
          if (pl.mode === "flydown") b.flapSaid = false;
        } else {
          // walk toward the planned spot at turkey speed
          const tx = pl.at[0], tz = pl.at[1];
          if (!b.pos) b.pos = b.seen ? new THREE.Vector3(o.position.x, 0, o.position.z) : new THREE.Vector3(tx, 0, tz); // first look: already there
          const dx = tx - b.pos.x, dz = tz - b.pos.z, d = Math.hypot(dx, dz);
          if (d > 12) b.pos.set(tx, 0, tz);
          const sp = Math.min(d, (d > 2 ? 1.6 : 0.7) * dt);
          if (d > 0.05) { b.pos.x += dx / d * sp; b.pos.z += dz / d * sp; }
          b.speedNow = sp / Math.max(dt, 1e-3);
          o.position.set(b.pos.x, 0, b.pos.z);
          if (b.speedNow > 0.25) { b.dir += Math.atan2(Math.sin(Math.atan2(dx, dz) - b.dir), Math.cos(Math.atan2(dx, dz) - b.dir)) * Math.min(1, dt * 4); anim = "walk"; }
          else {
            // feeding: peck, peck, scratch (left, right, step back, look)
            const ph = ((now / 1000 + b.i * 3.3) % 9);
            anim = ph < 4 ? "peck" : ph < 6.2 ? "scratch" : "look";
            if (anim === "scratch" && (T.stage === "feed" || T.stage === "gather" || T.stage === "gather2" || T.stage === "out" || T.stage === "back") && Math.random() < dt * 0.35) scratchPatch(o.position.x, o.position.z + Math.cos(b.dir) * 0.3);
          }
          // Rusty struts on the ground sometimes (most in the morning gathering and around the acorns)
          if (b.kind === "jake" && anim !== "walk") {
            const win = Math.floor((now / 1000 + 11) / 50) % 3 === 0;
            if (win && T.stage !== "out" && T.stage !== "back") anim = "strut";
          }
        }
        b.seen = true;
        // ---- pose ----
        b.strut += ((anim === "strut" ? 1 : 0) - b.strut) * Math.min(1, dt * 2.5);
        if (anim === "strut" && b.strut > 0.6 && !b.strutting) { b.strutting = true; tstats.struts++; b.drumIn = 0.5; }
        if (anim !== "strut") b.strutting = false;
        if (b.strutting) { b.drumIn -= dt; if (b.drumIn <= 0) { spitDrum(b); b.drumIn = 6 + Math.random() * 4; b.dir += 0.6; } } // a few steps, a half turn: show off the fan from all sides
        o.rotation.y = b.dir;
        const s = b.strut;
        const sc = b.kind === "jake" ? 0.9 : 1;
        o.scale.set(sc * (1 + s * 0.08), sc * (1 + s * 0.04), sc * (1 + s * 0.06));
        let headX = 0, bob = 0;
        if (anim === "walk") { headX = Math.sin(tt * 7 + b.i) * 0.12; bob = Math.abs(Math.sin(tt * 7 + b.i)) * 0.05; }
        if (anim === "peck") { const q = (tt * 1.6 + b.i) % 1; headX = q < 0.35 ? Math.sin(q / 0.35 * Math.PI) * 1.0 : 0.15; }
        if (anim === "scratch") { headX = 0.45; o.rotation.x = Math.sin(tt * 10) * 0.05 - 0.08; } else o.rotation.x = 0;
        if (anim === "look") headX = -0.1 + Math.sin(tt * 0.7 + b.i) * 0.05;
        if (anim === "sleep") headX = -0.55;           // head tucked back into the feathers
        if (anim === "perchawake") headX = Math.sin(tt * 0.5 + b.i) * 0.15;
        if (anim === "strut") headX = -0.42;           // the S-neck
        if (b.sound > 0) { headX = -0.15 + Math.sin(tt * 30) * 0.05; b.sound -= dt; } // stretch up to call
        P.head.rotation.x += (headX - P.head.rotation.x) * Math.min(1, dt * 9);
        o.position.y = y + bob;
        if (P.fan) { P.fan.rotation.x = -1.28 * (1 - s); P.fan.scale.set(0.24 + 0.76 * s, 1, 1); }
        for (const [w, sx] of [[P.wl, -1], [P.wr, 1]]) if (w) {
          w.rotation.z = wingFlap ? sx * (0.4 + Math.sin(tt * 18) * 0.9) : 0;
          w.rotation.x = -0.32 * s;                     // wings dropped: primaries drag on the ground
        }
        if (P.snood) P.snood.scale.set(1, 1, 1 + s * 0.9);
        if (P.skinMat) {                                // red, white AND blue when he's showing off
          const k = s > 0.3 ? (Math.sin(tt * 0.9) + 1) / 2 : 0;
          P.skinMat.color.copy(red).lerp(pink, 1 - Math.min(1, s * 2 + 0.6));
          P.crownMat.color.copy(white).lerp(blue, k * 0.8);
        }
        b.tag.update(dt, camera, tmp.copy(o.position).setY(o.position.y + 2.6), o.visible);
      }

      // ---- the flock talks ----
      const jake = birds[0];
      gobbleIn -= dt; yelpIn -= dt; putCool -= dt;
      if (T.stage === "treetalk" && gobbleIn <= 0) { gobble(jake); gobbleIn = 18 + Math.random() * 25; }
      if ((T.stage === "gather" || T.stage === "feed") && gobbleIn <= 0) { if (Math.random() < 0.4) gobble(jake); gobbleIn = 45 + Math.random() * 60; }
      if (yelpIn <= 0) {
        const h = birds[1 + Math.floor(Math.random() * 5)];
        if (T.stage === "treetalk" || T.stage === "flydown") yelp(h, 2, true);
        else if (T.stage === "flyup" || T.stage === "gather2" || T.stage === "out" || T.stage === "back") yelp(h, 3);
        else if (T.stage !== "roost" && Math.random() < 0.5) purr(h);
        yelpIn = 8 + Math.random() * 14;
      }
      // SHOCK GOBBLE: a loud noise makes a gobbler gobble back. Biscuit's whistle, and Hoo the owl's hoot (hunters use owl hoots at dawn for this!)
      const tr = trainAt(nowD).stage;
      if (tr === "running" && lastTrain === "boarding" && T.stage !== "roost") setTimeout(() => gobble(jake, " (that's for the TRAIN)"), 900);
      lastTrain = tr;
      if (stats.hoots !== lastHoots) { lastHoots = stats.hoots; if (Math.random() < 0.6) setTimeout(() => gobble(jake, " (shock gobble!)"), 1200); }
      // if I walk right up to them, Hazel putts (alarm!), then decides it's just me
      if (me.room === "outside" && putCool <= 0) {
        const hz = birds[1].obj.position;
        if (Math.hypot(mePos.x - hz.x, mePos.z - hz.z) < 3.2) {
          putt(birds[1]); putCool = 90;
          setTimeout(() => purr(birds[1]), 2500);
          if (saidHi !== today()) { saidHi = today(); setTimeout(() => say("She PUTTED at me! …and now she's purring. I think that means 'oh, it's just the little white cousin.'", 6), 1200); }
        }
      }
      for (const p of patches) { p.age += dt; if (p.age > 420) p.m.material.opacity = Math.max(0, 0.85 * (1 - (p.age - 420) / 180)); }
    },
    onClick() { showFlock(); gobble(birds[0]); }
  };

  function showFlock() {
    const nowD = new Date(), T = turkeysAt(nowD), p = dayPlan(nowD);
    const names = FLOCK.map(f => `<li><b>${f.name}</b> (${f.kind}): ${f.note}</li>`).join("");
    openModal("🦃 OJ Turkeys: my wild cousins", `Right now the flock is ${T.label}.`, `
      <p>Six wild turkeys live in my east field. Turkeys and chickens are both <b>Galliformes</b> (the scratch-the-ground birds), and a turkey's mitochondrial DNA is about <b>85% like a chicken's</b>. So: cousins. Very, VERY big cousins. Rusty is taller than me.</p>
      <ul style="margin:6px 0 10px 18px;padding:0">${names}</ul>
      <p>📅 <b>Their day today</b> (it's the same loop every day, they're creatures of habit):<br>
      ${timeStr(p.talk)} tree talk (soft yelps up in the Roost, Rusty gobbles) · ${timeStr(p.down(0))} fly down, one by one ·
      ${timeStr(p.outStart)} walk the east field to the acorn oak · ${timeStr(p.backStart)} walk home · ${timeStr(p.up(0))} fly up to the Roost (sunset ${timeStr(p.set)}).</p>
      <p>🌳 <b>They sleep in a TREE.</b> Foxes can't get them up there. At sunset they fly straight up, one at a time, then hop branch to branch to get higher. In the morning lots of them just… crash. <i>Flump.</i></p>
      <p>🍂 <b>Acorns are their fall fuel</b> ("mast"). They scratch the leaves away and leave big bare patches. That's how you find a flock. Look under the far oak!</p>
      <p>🪶 <b>The strut:</b> tail fanned straight up, wings dropped till the feathers drag, puffed up, neck in an S, head going red, white and BLUE, the snood (the dangly bit over his beak) stretching long. And two sounds: <b>pfft</b> (the "spit") and a low <b>vrrrummm</b> (the "drum"). Rusty is only a jake, but he practices on everyone.</p>
      <p>🗣️ <b>Turkey talk:</b> yelp = "where is everybody?" · cluck + purr = "all good" · PUTT = "danger, LEAVE" · gobble = "I'm here!" A loud noise makes gobblers <b>shock gobble</b>: Rusty gobbles back at Biscuit's whistle and at Hoo the owl.</p>
      <p>🚫🌽 <b>I don't feed them.</b> Wildlife people say feeding wild turkeys makes them bold and crowded and sick. The best present is oak trees. (Same as the bread rule for ducks!)</p>
      <p><button id="tkLook" class="paper pill" style="cursor:pointer;font:800 15px Nunito,sans-serif;padding:6px 14px">👀 Take me to the flock</button></p>
      <p style="color:var(--muted);font-size:14px">Since you got here: ${tstats.gobbles} gobbles, ${tstats.struts} struts, ${tstats.patches} scratched patches, ${tstats.putts} putts.</p>`);
  }
}
