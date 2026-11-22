// OJ Balloons (Day 10): Montauciel II, my hot-air balloon. It follows world/balloon.js, so everybody sees the same flight:
// at sunrise and before sunset on calm dry days I let go a pibal (a little red pilot balloon) to read the winds, lay the
// envelope out downwind on a ground cloth, blow cold air in with the fan, light the burner to stand it up, hop in, and fly
// my yard's little "box": low one way, up high back the other way, down onto my field. Then the parachute valve opens and
// it sighs back down onto the grass. Click it for a tethered hop (any time it's calm and light), or to read the flight board.
import { balloonAt, hopAt, HOP_LEN, FIELD, flightsFor, timeStr, LOW, HIGH } from "../world/balloon.js";
import { weatherAt } from "../world/weather.js";
import { daylight } from "../world/sky.js";

let ac = null;
addEventListener("pointerdown", () => { try { ac ??= new (window.AudioContext || window.webkitAudioContext)(); ac.resume?.(); } catch { } }, { capture: true });

export default function setup({ THREE, obj, scene, say, sim, chicken, objects, openModal, react, chickenInfo, camera }) {
  let ok = false, env, valve, cables, flame, pilot, seat, yawG, tiltG, flameMats = [], envMats = [], valve0 = 0, light;
  const MOUTH = 3.35;
  function init() {
    env = obj.getObjectByName("envelope"); if (!env) return false;
    valve = obj.getObjectByName("valve"); cables = obj.getObjectByName("cables"); flame = obj.getObjectByName("burner_flame");
    pilot = obj.getObjectByName("pilot"); seat = obj.getObjectByName("seat");
    // wrap the envelope in two groups: yaw (which way it lies) and tilt (lying down -> standing up)
    yawG = new THREE.Group(); tiltG = new THREE.Group(); obj.add(yawG); yawG.add(tiltG);
    yawG.position.copy(env.position); tiltG.add(env); env.position.set(0, 0, 0);
    env.traverse(c => { if (c.isMesh) { c.material = c.material.clone(); c.material.side = THREE.DoubleSide; c.castShadow = true; envMats.push(c.material); c.material.emissive = c.material.color.clone().multiply(new THREE.Color("#ffb070")); c.material.emissiveIntensity = 0; } });
    if (flame) flame.traverse(c => { if (c.isMesh) { c.material = c.material.clone(); c.material.transparent = true; c.material.depthWrite = false; flameMats.push(c.material); c.castShadow = false; } });
    if (valve) valve0 = valve.position.y;
    light = new THREE.PointLight("#ffa050", 0, 14, 1.5); light.position.set(0, MOUTH + 2.5, 0); obj.add(light);
    ok = true; return true;
  }

  // the ground cloth (so the envelope doesn't get grass stains)
  const tarp = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 11), new THREE.MeshStandardMaterial({ color: "#d9cdb4", roughness: 1 }));
  tarp.rotation.x = -Math.PI / 2; tarp.receiveShadow = true; tarp.visible = false; scene.add(tarp);
  // the pibal: a little red balloon on a string that I let go to see which way the wind blows up high
  const pibal = new THREE.Group();
  const pb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshStandardMaterial({ color: "#f0343e", roughness: 0.3 })); pb.scale.y = 1.18; pibal.add(pb);
  const ps = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 4), new THREE.MeshStandardMaterial({ color: "#e8dcc0" })); ps.position.y = -0.62; pibal.add(ps);
  pibal.visible = false; scene.add(pibal);
  // tether ropes for hops
  const ropeMat = new THREE.MeshStandardMaterial({ color: "#d8c49a", roughness: 0.9 });
  const ropes = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.BufferGeometry(), ropeMat); m.visible = false; scene.add(m); return m; });
  const stakes = [0, 1, 2].map(k => { const a = Math.PI / 2 + k * Math.PI * 2 / 3; return new THREE.Vector3(FIELD[0] + Math.cos(a) * 3.6, 0.35, FIELD[1] - Math.sin(a) * 3.6); });

  // burner roar (only after you've clicked something: browsers keep quiet until then)
  let noise = null, roar = null;
  function roarOn(on, vol) {
    if (!ac || ac.state !== "running") return;
    if (!roar) {
      noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = noise.getChannelData(0); let b = 0;
      for (let i = 0; i < d.length; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 6 + (Math.random() * 2 - 1) * 0.15; }
      const src = ac.createBufferSource(); src.buffer = noise; src.loop = true;
      const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 700;
      const g = ac.createGain(); g.gain.value = 0; src.connect(lp).connect(g).connect(ac.destination); src.start(); roar = g;
    }
    roar.gain.setTargetAtTime(on ? vol : 0, ac.currentTime, on ? 0.05 : 0.15);
  }

  // riding: my seat in the basket
  let aboard = false, hopT0 = -1, blast = 0, blastNext = 0, yaw = 0, S = null, lastStage = "", pibalT0 = -1, pibalPos = new THREE.Vector3(), saidUp = false;
  const sv = new THREE.Vector3();
  const ride = () => { if (!aboard || !seat) return null; seat.getWorldPosition(sv); return { x: sv.x, y: sv.y, z: sv.z, yaw: obj.rotation.y + Math.PI * 0, wind: 0 }; };
  const dirV = a => [Math.sin(a), -Math.cos(a)];       // "blows TO a" -> yard x, z
  const nowS = () => performance.now() / 1000;

  function hopOK() {
    const w = weatherAt(new Date());
    if (daylight(new Date()) < 0.4) return "It's dark! Balloons land before sunset. Come back in the daytime and I'll take you up on the ropes.";
    if (w.rain > 0.05) return "It's raining. A wet envelope weighs a ton and the burner hisses. Rain check! (Ha. Rain check.)";
    if (w.knots > 13) return `Too windy for a tethered hop (${w.knots} knots). The envelope would lean over like a sail. Maybe later!`;
    return null;
  }

  return {
    update(dt, t) {
      if (!ok && !init()) return;
      const now = new Date();
      const hopSec = hopT0 >= 0 ? nowS() - hopT0 : -1;
      if (hopSec > HOP_LEN) hopT0 = -1;
      const sched = balloonAt(now);
      S = hopT0 >= 0 && sched.stage === "packed" ? hopAt(hopSec, (weatherAt(now).dir ?? 0) + Math.PI) : sched;

      // where the basket is (the whole balloon moves; it turns slowly in flight, the way real ones do)
      obj.position.set(S.x, S.y, S.z);
      if (S.stage === "flying") yaw += dt * 0.06; else yaw += (0 - yaw) * Math.min(1, dt * 0.2);
      obj.rotation.y = yaw;

      // the envelope: lying downwind on the cloth -> puffed up with the fan -> standing up on hot air
      const f = S.fill, u = S.up, [dx, dz] = dirV(S.lay ?? 0);
      env.visible = f > 0.005;
      const lay = Math.atan2(dx, dz) - yaw;
      yawG.rotation.y = lay;
      tiltG.rotation.x = (1 - u) * Math.PI / 2 * 0.97;
      yawG.position.set(Math.sin(lay) * (1 - u) * 1.3, THREE.MathUtils.lerp(THREE.MathUtils.lerp(0.25, 2.3, f), MOUTH, u), Math.cos(lay) * (1 - u) * 1.3);
      const flat = THREE.MathUtils.lerp(0.07, 1, f), wide = THREE.MathUtils.lerp(0.62, 1, f);
      env.scale.set(THREE.MathUtils.lerp(wide, 1, u), THREE.MathUtils.lerp(0.92, 1, Math.max(f, u)), THREE.MathUtils.lerp(flat, 1, u));
      // a little breathing in the fabric while it fills
      if (S.stage === "cold" || S.stage === "layout") env.scale.z *= 1 + Math.sin(t * 2.3) * 0.03 * f;
      if (cables) cables.visible = u > 0.96;
      if (valve) valve.position.y = valve0 + (S.valve ? 0.35 + Math.sin(t * 5) * 0.03 : 0);

      // the ground cloth lies downwind while the envelope's on the ground
      tarp.visible = (f > 0.005 && u < 0.99) || S.stage === "layout";
      if (tarp.visible) { tarp.position.set(FIELD[0] + dx * 5.9, 0.03, FIELD[1] + dz * 5.9); tarp.rotation.set(-Math.PI / 2, Math.atan2(dx, dz), 0, "YXZ"); }

      // the inflator fan
      const fan = objects["oj-balloon-field"]?.getObjectByName("fan_blades");
      if (fan) fan.rotation.z -= dt * 28 * (S.fan ?? 0);

      // the burner: big blasts to climb, short blips to stay level, quiet coming down
      blastNext -= dt;
      if (blastNext <= 0) {
        if (S.burn >= 0.9) { blast = 2.2 + Math.random() * 1.2; blastNext = blast + 0.4 + Math.random() * 0.6; }
        else if (S.burn > 0.1) { blast = 0.9 + Math.random() * 0.8; blastNext = blast + 4 + Math.random() * 5; }
        else if (S.burn > 0.01) { blast = 0.6; blastNext = 9 + Math.random() * 6; }
        else { blast = 0; blastNext = 0.5; }
      }
      blast -= dt; const on = blast > 0;
      if (flame) {
        flame.visible = on; flame.scale.set(1 + Math.sin(t * 31) * 0.1, (1 + Math.sin(t * 23) * 0.15 + Math.sin(t * 57) * 0.08) * (u < 0.6 ? 1.6 : 1.15), 1 + Math.cos(t * 29) * 0.1);
        flame.rotation.x = 0; flame.rotation.z = 0;
        if (u < 0.6) { flame.rotation.y = 0; const tl = (1 - u) * 1.2; flame.rotation.set(Math.cos(lay) * tl, 0, -Math.sin(lay) * tl); } // pointing into the mouth while the envelope still lies down
        flameMats.forEach(m => m.opacity = 0.85 + Math.sin(t * 40) * 0.1);
      }
      if (pilot) pilot.visible = S.stage !== "packed" && S.stage !== "pack" && S.stage !== "pibal";
      const dusk = 1 - daylight(now);
      light.intensity = on ? 30 + dusk * 60 : 0;
      envMats.forEach(m => m.emissiveIntensity += ((on && u > 0.3 ? 0.06 + dusk * 0.4 : 0) - m.emissiveIntensity) * Math.min(1, dt * 8));
      const near = camera ? Math.max(0, 1 - camera.position.distanceTo(obj.position) / 70) : 0.5;
      roarOn(on, 0.06 * near * (aboard ? 1.6 : 1));

      // the pibal: let go 14 minutes before liftoff. It drifts one way low down, then turns round up high (the box!)
      const tied = objects["oj-balloon-field"]?.getObjectByName("pibal_tied");
      if (S.pibal >= 0 && S.flight && !S.tether) {
        const sec = S.pibal, hh = sec * 0.32, f2 = S.flight;
        const [lx, lz] = dirV(f2.lowDir), [hx, hz] = dirV(f2.highDir);
        const lowH = Math.min(hh, 13), highH = Math.max(0, hh - 13);
        const fo = objects["oj-balloon-field"];
        pibal.position.set((fo ? fo.position.x : FIELD[0]) + 3 + lx * lowH * 0.5 + hx * highH * 0.6, 1.5 + hh, (fo ? fo.position.z : FIELD[1]) + 2.6 + lz * lowH * 0.5 + hz * highH * 0.6);
        pibal.rotation.z = Math.sin(t * 2) * 0.15; pibal.visible = hh < 70; if (tied) tied.visible = false;
      } else { pibal.visible = false; if (tied) tied.visible = true; }

      // tether ropes during a hop
      for (let i = 0; i < 3; i++) {
        const r = ropes[i]; r.visible = !!S.tether && S.up > 0.5;
        if (r.visible && Math.floor(t * 20) % 2 === 0) {
          const a = new THREE.Vector3(obj.position.x + (stakes[i].x - FIELD[0]) * 0.18, obj.position.y + 0.9, obj.position.z + (stakes[i].z - FIELD[1]) * 0.18);
          const mid = a.clone().lerp(stakes[i], 0.5); mid.y -= 0.4 * Math.max(0, 1 - S.y / 6);
          r.geometry.dispose(); r.geometry = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, stakes[i]), 16, 0.035, 5, false);
        }
      }

      // me: hop in at weigh-off if I'm here for it, hop out after we land
      const info = chickenInfo ? chickenInfo() : { act: sim?.act, room: "outside" };
      const want = info.act === "balloon" && info.room === "outside" && !info.up;
      if (!aboard && want && S.aboard && seat && chicken) {
        seat.getWorldPosition(sv);
        if ((Math.hypot(chicken.position.x - sv.x, chicken.position.z - sv.z) < 3.2 && obj.position.y < 1) || (!S.tether && S.stage !== "weighoff")) { aboard = true; say(["Hop in! (That's me. I hopped.)", "Pilot aboard! Hands off… weigh-off… LIGHT!", "A rooster flew at Versailles in 1783. Now a chicken flies at OJ. Bawk!"][Math.floor(Math.random() * 3)], 4); }
      }
      if (aboard && (!S.aboard || (!want && obj.position.y < 0.5))) {
        aboard = false; chicken.position.set(FIELD[0] + 1.9, 0, FIELD[1] + 1.2);
        say(S.tether ? "Back on the ground! Thanks for flying OJ Balloons." : "Touchdown! Bump, slide, stop. What a flight!", 4);
      }
      if (aboard) chicken.userData.ride = ride; else if (chicken.userData.ride === ride) chicken.userData.ride = null;

      // a few things to say along the way
      if (S.stage !== lastStage) {
        const near2 = chicken && Math.hypot(chicken.position.x - obj.position.x, chicken.position.z - obj.position.z) < 12;
        const lines = { pibal: "Pibal away! Watch which way it goes when it gets up high…", layout: "Envelope out on the cloth, downwind. Crown line ready.", cold: "Fan on! Cold air first. It's breathing!", hot: "Burner! Into the mouth… up she comes!", flying: aboard ? "Liftoff! Look, my coop! Look, Biscuit! Look, EVERYTHING!" : null, landed: null, deflate: "Pull the parachute valve… pfffffff.", };
        if (lines[S.stage] && (near2 || aboard)) say(lines[S.stage], 4);
        lastStage = S.stage; saidUp = false;
      }
      if (aboard && S.stage === "flying" && !saidUp && S.y > HIGH - 3) { saidUp = true; say("Up high the wind goes the OTHER way. Taking us home! (That's the box.)", 5); }
    },
    onClick() {
      const now = new Date(), s = balloonAt(now);
      if (s.stage === "packed" && hopT0 < 0) {
        const no = hopOK();
        if (no) say(no, 5);
        else {
          hopT0 = nowS(); say("A tethered hop? YES. Ropes on, fan on. Wait for me!", 4);
          react?.({ act: "balloon", run: [FIELD[0] + 1.6, FIELD[1] + 0.8], secs: 80, text: "Odyssey Jr. is running over for a tethered balloon hop!" });
        }
      } else if (hopT0 >= 0) say("We're already going up! Hold on to the edge.", 3);
      else say(s.stage === "flying" ? "Bye! I'll wave! (Wings count as waving.)" : "Crew to the basket! Flight in progress.", 3);
      const fl = flightsFor(now).map(f => {
        const past = now - f.L > 26 * 60000;
        return `<tr><td>${f.name}</td><td>${timeStr(f.L)}</td><td>${f.go ? (past ? "✅ flown" : "🎈 GO") : "⛔ " + f.why}</td></tr>`;
      }).join("");
      const w = weatherAt(now), next = s.next;
      const where = s.stage === "flying" ? `<b>In the air!</b> ${Math.round(s.y * 0.5 * 10) / 10 > 0 ? `About ${Math.round(s.y)} units up (that's ${Math.round(s.y / 2)} of me stacked up).` : ""} ${s.y > 15 ? "Up high, riding the wind back home." : "Low down, drifting with the ground wind."}`
        : s.stage === "packed" ? (next ? `Packed in its bag. Next flight: <b>${next.name.toLowerCase()} at ${timeStr(next.L)}</b>${next.L.getDate() !== now.getDate() ? " tomorrow" : ""}.` : "Packed in its bag. No calm flight in the forecast yet.")
        : ({ pibal: "Reading the winds with a pibal.", layout: "Laying the envelope out on the ground cloth.", cold: "Cold inflation: the fan is blowing air in.", hot: "Hot inflation: the burner is standing it up!", weighoff: "Weigh-off: just floating, feet off… ready…", landed: "Landed on the field!", deflate: "Deflating: the parachute valve is open.", pack: "Packing it up, squeezing the air out." })[s.stage] ?? "";
      openModal("🎈 OJ Balloons", "Montauciel II · flights at sunrise and before sunset, calm dry days only · click again for a tethered hop", `
        <p>${where}</p>
        <p class="secLabel">TODAY'S FLIGHT BOARD</p>
        <table style="width:100%;font-size:14px">${fl}</table>
        <p style="font-size:13px">Ground wind now: ${w.knots} knots from the ${w.from}. I fly at ${8} knots or less, never in rain, and I always land before sunset.</p>
        <p class="secLabel">THINGS I LEARNED</p>
        <p>🐑🦆🐓 <b>Sept 19, 1783, Versailles:</b> the very first passengers in history went up in the Montgolfier brothers' hot-air balloon: a sheep called <b>Montauciel</b> ("climb-to-the-sky"), a duck, and a <b>rooster</b>. Eight minutes, two miles, landed in a wood. All fine (the sheep kicked the rooster). My balloon is Montauciel II. A chicken in the basket again!</p>
        <p>🔥 Hot air is lighter than cool air, so a giant bag of it floats. The envelope stays around 100 °C inside. Burner = up. Parachute valve (a lid in the top) = let hot air out = down. <b>There's no steering wheel.</b></p>
        <p>🧭 You steer by going UP or DOWN, because the wind blows different ways at different heights. Before each flight I let go a little red <b>pibal</b> (pilot balloon) and watch it. In Albuquerque there's the famous <b>"box"</b>: on calm cold mornings, cold air slides downhill and blows one way down low, while the wind above blows back. Fly out low, climb, ride home, land where you started. My yard has a tiny box: cold air slides off Tunnel Hill.</p>
        <p>🌅 Balloons fly just after sunrise and before sunset, when the air is calm. At midday the sun heats the ground and makes bubbles of rising air (thermals) that bounce balloons around.</p>
        <p>🕯️ In a balloon you feel <b>no wind at all</b>, because you're moving WITH it. A candle wouldn't flicker. My comb doesn't flap. It's so quiet up there, except for the burner. ROOAAR.</p>`);
    }
  };
}
