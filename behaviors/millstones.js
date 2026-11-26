// Inside OJ Mill (Day 14): the stone floor. Everything here is driven from the sails outside (world/mill.js):
// great spur wheel -> stone nut -> quant -> runner stone (about 9 turns for every turn of the sails).
// The damsel (four knobs on the quant) knocks the shoe so grain trickles into the eye of the stone: the faster the
// stones, the faster it knocks. Millers said it never stopped chattering. The governor's balls swing out as it speeds up.
// Flour comes out of the meal spout into my sack, and the sack fills with today's flour.
import { millAt } from "../world/mill.js";

export default function setup({ THREE, obj, say, openModal }) {
  let runner, spur, nut, shoe, gov, arms = [], flour, ok = false;
  let M = millAt(), tick = 0, w = 0, aR = 0, knock = 0, shoeX = null, ctx = null, clackUntil = 0, nextClack = 0;
  const dustMat = new THREE.MeshStandardMaterial({ color: "#fffaf0", roughness: 1 });
  const grain = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.6, 6), new THREE.MeshStandardMaterial({ color: "#e0b45a", roughness: 0.8 }));
  grain.position.set(0, 1.3, 0.03); obj.add(grain);
  const dust = []; for (let i = 0; i < 10; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), dustMat); obj.add(d); dust.push({ d, t: i / 10 }); }
  function init() {
    runner = obj.getObjectByName("runner"); spur = obj.getObjectByName("spur"); nut = obj.getObjectByName("stonenut");
    shoe = obj.getObjectByName("shoe"); gov = obj.getObjectByName("gov"); flour = obj.getObjectByName("flour");
    arms = [obj.getObjectByName("gov_arm_1"), obj.getObjectByName("gov_arm_2")];
    if (!runner || !spur || !nut || !shoe || !gov || !flour || !arms[0]) return false;
    shoeX = shoe.rotation.x; return ok = true;
  }
  function clack() {   // the damsel knocking the shoe: a short woody tick
    if (!ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = "square"; o.frequency.value = 180 + Math.random() * 60; f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(f); f.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.06);
  }
  return {
    update(dt, t) {
      if (!ok && !init()) return;
      tick -= dt; if (tick <= 0) { tick = 2; M = millAt(); }
      const goal = M.grinding ? M.rpm * Math.PI * 2 / 60 : 0;      // sail speed (rad/s)
      w += (goal - w) * Math.min(1, dt * 0.25);
      aR += w * dt;
      runner.rotation.y = aR * 9;
      nut.rotation.y = aR * 9;
      spur.rotation.y = -aR * 2.25;                                  // big wheel, opposite way
      gov.rotation.y = aR * 9;
      const swing = Math.min(0.7, w * 0.55);                         // flyballs swing out as the stones speed up
      arms[0].rotation.z = -swing; arms[1].rotation.z = swing;
      // the damsel: four knocks per turn of the quant
      const k = Math.floor(aR * 9 / (Math.PI / 2));
      if (k !== knock) { knock = k; shoe.rotation.x = shoeX + 0.05; if (performance.now() < clackUntil && performance.now() > nextClack) { clack(); nextClack = performance.now() + 60; } }
      shoe.rotation.x += (shoeX - shoe.rotation.x) * Math.min(1, dt * 18);
      // grain trickle + flour dust
      const on = w > 0.05;
      grain.visible = on; grain.scale.x = grain.scale.z = 0.8 + Math.sin(t * 20) * 0.2;
      for (const p of dust) {
        p.d.visible = on;
        if (on) { p.t = (p.t + dt * 0.7) % 1; p.d.position.set(1.05 + Math.sin(p.t * 9 + t) * 0.05, 0.82 - p.t * 0.12 + Math.sin(p.t * 30) * 0.02, 1.52 + p.t * 0.2); p.d.scale.setScalar(1 - p.t * 0.6); }
      }
      // the sack fills (and a new one starts every whole sack)
      const f = M.flourToday % 1;
      flour.scale.y = 0.35 + 0.65 * (M.grinding || f > 0 ? f : 0.6);
    },
    onClick() {
      M = millAt();
      if (M.grinding) {
        try { ctx = ctx ?? new (window.AudioContext || window.webkitAudioContext)(); ctx.resume(); } catch { }
        clackUntil = performance.now() + 7000;
        say("Hear that? Clackety-clack. That's the damsel knocking the shoe. Never stops talking!", 5);
      } else say("The stones are resting. Bed stone at the bottom never moves. Runner on top does the work.", 5);
      openModal("🌾 The stone floor", "Inside OJ Mill.", `
        <p>${M.grinding ? `The runner stone is turning <b>${Math.round(M.stoneRpm)} times a minute</b> (the sails do ${M.rpm.toFixed(1)}).` : "Right now the stones are still: " + M.why}</p>
        <p><b>Flour today:</b> ${M.flourToday} sacks. My first ever flour, on Thanksgiving. Tomorrow it goes in my first sourdough loaf.</p>
        <p>🪨 <b>Bed stone</b> (bottom): never moves. <b>Runner stone</b> (top): turns on it. Grain goes in the hole in the middle (the <b>eye</b>), gets cracked and rubbed as it slides outwards along the grooves, and comes out of the edge as flour.</p>
        <p>〰️ The grooves are <b>furrows</b>, the flat bits are <b>lands</b>. They're cut in groups called <b>harps</b> (my spare stone against the wall shows them). The furrows on the two stones cross like scissors. When they wear smooth, the miller re-cuts them with a <b>mill bill</b>: that's called dressing the stone.</p>
        <p>⚙️ Sails → brake wheel → wallower → upright shaft → <b>great spur wheel</b> (the big one up there) → <b>stone nut</b> → quant → runner. The little gear does 4 turns for every 1 of the big one.</p>
        <p>🔨 The <b>damsel</b> is the four knobs on the spindle. Each one knocks the <b>shoe</b> (the little tray under the hopper) so grain jiggles out. Faster stones, faster knocks: the mill feeds itself just as fast as it can grind.</p>
        <p>🟡 The brass balls are a <b>governor</b>. Faster = they swing out = the runner gets lowered a hair. Windmills had them before steam engines did!</p>`);
    }
  };
}
