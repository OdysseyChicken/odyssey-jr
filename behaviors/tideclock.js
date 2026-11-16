// OJ Tides (Day 4, bonus 2): the tide board for Pip's beach. The math lives in world/tide.js (real moon + real sun).
// - The clock hand goes round once every high-to-high (about 12 h 25 min): HIGH at the top, LOW at the bottom.
// - The blue water in the glass tube goes up and down with the tide on the island. Below the sand line = beach open.
// - The green lamp glows when the beach is uncovered enough for OJ-1 to land (Pip said: LOW TIDE ONLY).
// - Click it for the next highs and lows (in your own time), today's curve, and spring vs neap.
import { tideAt, nextTurns, tideCurve, beachOpen, BEACH_LINE, TWELFTHS } from "../world/tide.js";
import { moonName } from "../world/sky.js";

const HALF_LUNAR = 12.42 * 3600000;
const fmt = d => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const day = d => { const n = new Date(); return d.toDateString() === n.toDateString() ? "today" : "tomorrow"; };

export default function setup({ THREE, obj, say, sim, openModal, react, chickenInfo }) {
  let hand = null, water = null, lamp = null, found = false, recalc = 0, state = null, chat = 3;
  let handNow = null, waterNow = null;

  function find() {
    hand = obj.getObjectByName("tide_hand"); water = obj.getObjectByName("tide_water");
    const l = obj.getObjectByName("tide_lamp");
    if (l) l.traverse(c => { if (c.isMesh && !lamp) { c.material = c.material.clone(); lamp = c.material; lamp.emissive = new THREE.Color(0.2, 1, 0.3); lamp.toneMapped = false; } });
    found = !!(hand || water);
  }

  // where the clock hand points: 0 = HIGH (top), 0.5 = LOW (bottom), going clockwise
  function work() {
    const now = new Date(), t = tideAt(now), turns = nextTurns(now, 4);
    const nh = turns.find(x => x.kind === "high");
    const frac = nh ? 1 - Math.min(1, (nh.time - now) / HALF_LUNAR) : 0;
    state = { t, turns, frac, open: beachOpen(now) };
  }
  const level = h => Math.max(0.08, Math.min(0.97, 0.4 + (h - BEACH_LINE) * 0.25));

  function curveSVG() {
    const pts = tideCurve(new Date(), 24, 15), W = 520, H = 150, pad = 8;
    const x = i => pad + i / (pts.length - 1) * (W - 2 * pad), y = h => H / 2 - h / 1.8 * (H / 2 - pad);
    const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.h).toFixed(1)}`).join("");
    const fill = line + `L${x(pts.length - 1)},${H}L${x(0)},${H}Z`;
    const marks = pts.map((p, i) => ({ p, i })).filter(({ p }) => p.time.getMinutes() < 15 && p.time.getHours() % 6 === 0)
      .map(({ p, i }) => `<line x1="${x(i)}" y1="0" x2="${x(i)}" y2="${H}" stroke="#2b2540" stroke-opacity=".12"/><text x="${x(i) + 3}" y="${H - 4}" font-size="11" fill="#555">${fmt(p.time)}</text>`).join("");
    const by = y(BEACH_LINE);
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;background:#f3ead2;border-radius:10px;border:2px solid #2b2540">
      <path d="${fill}" fill="#4f93c9" fill-opacity=".55"/><path d="${line}" fill="none" stroke="#1f5f96" stroke-width="2.5"/>
      <line x1="0" y1="${by}" x2="${W}" y2="${by}" stroke="#c9a24a" stroke-width="2" stroke-dasharray="6 4"/><text x="${W - 150}" y="${by + 14}" font-size="11" fill="#8a6a1a">below here: beach open</text>
      ${marks}<circle cx="${x(0)}" cy="${y(pts[0].h)}" r="5" fill="#d23"/><text x="${x(0) + 8}" y="${y(pts[0].h) - 6}" font-size="12" font-weight="700" fill="#d23">now</text></svg>`;
  }

  function panel() {
    work();
    const { t, turns, open } = state;
    const rows = turns.map(x => `<li><b>${x.kind === "high" ? "🌊 High" : "🏖️ Low"} tide</b> at ${fmt(x.time)} ${day(x.time)} (${x.h > 0 ? "+" : ""}${x.h.toFixed(1)} m)</li>`).join("");
    const kind = t.spring > 0.7 ? "SPRING tides (big!): the sun and moon are lined up" : t.spring < 0.3 ? "NEAP tides (small): the sun and moon are pulling at right angles" : "in between spring and neap";
    openModal("🌊 Pip's Beach Tides", "The tide on the island, worked out from where the real moon and sun are right now. (Times are in your time.)", `
      <p style="font-size:16px;margin:4px 0"><b>Right now:</b> ${t.h > 0 ? "+" : ""}${t.h.toFixed(2)} m and ${t.rising ? "<b>rising</b> (flood tide) ⬆️" : "<b>falling</b> (ebb tide) ⬇️"}. ${open ? "🟢 <b>The beach is OPEN.</b> OJ-1 could land on the sand!" : "🔴 The beach is under water. No landing right now."}</p>
      ${curveSVG()}
      <ul style="margin:10px 0;padding-left:20px;font-size:14px">${rows}</ul>
      <p style="font-size:14px;margin:6px 0">🌓 The moon is a <b>${moonName(t.phase)}</b>, so it's ${kind}. Range today: about ${t.range.toFixed(1)} m from low to high.</p>
      <details><summary style="cursor:pointer;font-weight:800">How tides work (I had to learn this for Pip)</summary><div style="font-size:13px">
      <p>The moon pulls the near side of the Earth a bit harder than the middle, and the middle harder than the far side. So the sea gets stretched into <b>two bulges</b>: one under the moon and one on the opposite side. The Earth spins under both, so a beach gets two highs and two lows a day.</p>
      <p>The moon moves along while we spin, so the bulges come back <b>about 50 minutes later every day</b>. That's why my tide clock's hand goes round once every 12 hours 25 minutes, not 12.</p>
      <p>The sun makes bulges too, a bit less than half as strong. New moon and full moon: sun and moon line up, <b>spring tides</b> (nothing to do with spring!). Quarter moons: they fight, <b>neap tides</b>.</p>
      <p><b>Rule of twelfths:</b> from low to high takes about 6 hours, and the water rises ${TWELFTHS.join(", ")} twelfths in each hour. Slow, fast, FAST, slow. So the middle hours are when the beach disappears quickest.</p></div></details>`);
  }

  return {
    update(dt, t) {
      if (!found) { find(); if (!found) return; }
      recalc -= dt; if (recalc <= 0 || !state) { work(); recalc = 20; }
      const targetA = state.frac * Math.PI * 2, targetW = level(state.t.h);
      handNow ??= targetA; waterNow ??= targetW;
      handNow += (targetA - handNow) * Math.min(1, dt * 2); waterNow += (targetW - waterNow) * Math.min(1, dt * 2);
      if (hand) hand.rotation.z = -handNow;
      if (water) water.scale.y = waterNow;
      if (lamp) lamp.emissiveIntensity = state.open ? 2 + Math.sin(t * 2.5) * 0.4 : 0;
      const me = chickenInfo?.();
      if (sim?.act === "tides" && me && !me.busy && me.room === "outside") {
        chat -= dt;
        if (chat <= 0) {
          chat = 6 + Math.random() * 6;
          const nl = state.turns.find(x => x.kind === "low");
          say([state.open ? "The beach is OPEN! Pip, I'm... not ready yet." : `Low tide at ${nl ? fmt(nl.time) : "later"}. Noted.`, "Slow, fast, FAST, slow. That's the rule of twelfths.", "Two bulges! Two!", "The moon moves the whole SEA. And I can barely move a seed."][Math.floor(Math.random() * 4)], 3.5);
        }
      }
    },
    onClick() { panel(); react?.({ act: "tides", run: [13.4, 8.7], text: "reading the tide board for Pip's beach", secs: 6, say: "Let's see what the moon is doing to Pip's beach!" }); }
  };
}
