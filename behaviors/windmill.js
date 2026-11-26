// OJ Mill (Day 14): my tower windmill. The cap turns into the wind by itself (the fantail spins when the wind comes
// round and slowly winds the cap after it), the sails turn with the real yard wind (world/mill.js), and the canvas on
// each sail is set for the wind: full sail, dagger point, sword point, first reef, or rolled up.
// When the mill is stopped, the sails park in a signal: + long rest, X short rest, and on feast days REJOICING.
import { millAt, REEFS, PARK } from "../world/mill.js";

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const QUARTER = Math.PI / 2;

export default function setup({ THREE, obj, say, openModal, enterRoom, chickenInfo }) {
  let cap, sails, fan, cloths = [], ok = false;
  let M = millAt(), tick = 0, omega = 0, ang = 0, fanSpin = 0, wasGrinding = null;
  function init() {
    cap = obj.getObjectByName("cap"); sails = obj.getObjectByName("sails"); fan = obj.getObjectByName("fantail");
    if (!cap || !sails || !fan) return false;
    cloths = [1, 2, 3, 4].map(k => obj.getObjectByName("cloth_" + k)).filter(Boolean);
    cloths.forEach(c => c.traverse(n => { if (n.isMesh) { n.material = n.material.clone(); n.material.side = THREE.DoubleSide; } }));
    // start already facing the wind and parked, so nobody sees it whip round on load
    cap.rotation.y = wrap(Math.PI - M.dir - obj.rotation.y);
    ang = Math.PI / 4 + M.park; sails.rotation.z = ang;
    cloths.forEach(c => c.scale.x = Math.max(0.04, M.cloth));
    return ok = true;
  }
  return {
    update(dt, t) {
      if (!ok && !init()) return;
      tick -= dt; if (tick <= 0) { tick = 2; M = millAt(); }
      // ---- the cap + fantail: the fan spins while the sails aren't square to the wind, and winds the cap round
      const goal = wrap(Math.PI - M.dir - obj.rotation.y);
      const mis = wrap(goal - cap.rotation.y);
      const push = M.knots < 1 ? 0 : Math.sign(mis) * Math.min(1, Math.abs(mis) * 2.5);
      cap.rotation.y += push * (0.03 + M.knots * 0.004) * dt;
      const fanGoal = push * (2 + M.knots * 0.5) + Math.sin(t * 0.9) * Math.sin(t * 0.37) * M.knots * 0.04; // a little flutter in gusts
      fanSpin += (fanGoal - fanSpin) * Math.min(1, dt * 1.5);
      fan.rotation.x += fanSpin * dt;
      // ---- the sails
      const ci = chickenInfo?.(), reefing = ci && ci.act === "reef" && ci.up;   // sails stopped while I'm up there setting cloth
      if (M.grinding && !reefing) {
        const w = M.rpm * Math.PI * 2 / 60;
        omega += (w - omega) * Math.min(1, dt * 0.25);           // heavy sails: they take a while to wind up
      } else {
        const target = Math.PI / 4 + (reefing ? PARK.long : M.park);
        const d = ((target - ang) % QUARTER + QUARTER) % QUARTER; // sails only go forwards, so stop at the next one
        if (omega > 0.12) omega *= Math.exp(-dt * 0.45);
        else omega = d < 0.003 ? 0 : Math.min(0.12, d * 0.5 + 0.01);
      }
      ang += omega * dt; if (ang > Math.PI * 200) ang -= Math.PI * 200;
      sails.rotation.z = ang;
      // ---- the cloth, set for the wind (it changes slowly, like a miller doing it one sail at a time)
      const want = Math.max(0.04, M.cloth);
      cloths.forEach((c, i) => { c.scale.x += (want - c.scale.x) * Math.min(1, dt * (0.15 + i * 0.05)); });
      if (wasGrinding !== null && wasGrinding !== M.grinding && chickenInfo?.().room === "outside")
        say(M.grinding ? "The wind's up! Brake off… she's turning! 🌬️" : M.state === "calm" ? "Wind's dropped. The sails are drifting to a stop." : "Brake on.", 4);
      wasGrinding = M.grinding;
    },
    onClick() {
      M = millAt();
      say(M.grinding ? `${M.reef}! ${M.rpm.toFixed(1)} turns a minute. The stones are going ${Math.round(M.stoneRpm)}!` : M.why.split(".")[0] + ".", 4);
      const rows = REEFS.map((r, i) => `<div style="padding:4px 8px;border-radius:6px;${M.grinding && i === M.reefI ? "background:#ffe28a;font-weight:700" : ""}">${M.grinding && i === M.reefI ? "👉 " : ""}<b>${r.name}</b> (under ${r.max} knots): ${r.note}</div>`).join("");
      const st = M.grinding ? `🌬️ <b>Grinding!</b> ${M.reef} on all four sails. Sails ${M.rpm.toFixed(1)} rpm → great spur wheel ${M.spurRpm.toFixed(0)} rpm → runner stone <b>${Math.round(M.stoneRpm)} rpm</b>.`
        : `🛑 ${M.why} Sails parked: <b>${M.signal}</b>.`;
      openModal("🌾 OJ Mill", `My tower windmill.${M.fake ? " (Pretend wind from ?millwind in the address.)" : ""}${M.thanks ? " Happy Thanksgiving!" : ""}`, `
        <p><b>Wind:</b> about ${Math.round(M.knots)} knots from the ${M.from}. The cap and sails face the ${M.from} (the fantail on the back did that).</p>
        <p>${st}</p>
        <p><b>Flour today:</b> ${M.flourToday} sacks.</p>
        ${rows}
        <p style="margin-top:10px">Only the <b>cap</b> on top turns. The little striped windmill on its back is the <b>fantail</b> (Edmund Lee, 1745): when the wind swings round it catches it, spins, and slowly cranks the whole cap after the wind. When the sails face the wind square on, the fantail's blades are edge-on, so it stops. It steers itself!</p>
        <p>Stopped sails talk: <b>+</b> long rest, <b>X</b> short rest (back soon), top sail <b>just before the top</b> = rejoicing, <b>just past</b> = mourning.${M.thanks ? " Today my sails rest in rejoicing. It's Thanksgiving." : ""}</p>
        <p><button class="btn paper pill" id="millIn">🚪 Step inside and watch the stones</button></p>`);
      const b = document.getElementById("millIn"); if (b) b.onclick = () => { document.getElementById("modal")?.classList.remove("open"); enterRoom("mill"); };
    }
  };
}
