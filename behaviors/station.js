// Coop Junction (Day 9): my station. The clock under the roof keeps real time, the lamp comes on at dusk,
// and clicking it opens the timetable: when the next train goes, where Biscuit is right now, and the whistle codes.
import { trainAt, departures, LENGTH, RUN_T } from "../world/rail.js";

export default function setup({ obj, openModal, say }) {
  let hour, min, lampMat, ok = false;
  function init() {
    hour = obj.getObjectByName("clock_hour"); min = obj.getObjectByName("clock_min");
    const l = obj.getObjectByName("station_lamp"); if (l?.isMesh) { l.material = l.material.clone(); lampMat = l.material; }
    return (ok = !!hour);
  }
  const where = T => {
    if (T.stage === "night") return "asleep at the platform, fire banked, till the first train at 7:00 am";
    if (T.stage === "boarding") return T.next ? `waiting at the platform, filling up at the water tower. Leaves at ${T.nextStr}` : "done for the day, resting at the platform";
    const f = (T.s % LENGTH) / LENGTH;
    const part = f < 0.1 ? "just pulling out" : f < 0.4 ? "running along the west side, past the hangar" : f < 0.6 ? "going through Tunnel Hill (whoooo)" : f < 0.9 ? "coming down the east side, past OJ Tower and the radio shack" : "coming round the last bend";
    return `on the ${T.depStr} train, lap ${T.lap} of 2: ${part}`;
  };
  return {
    update() {
      if (!ok && !init()) return;
      const d = new Date(), m = d.getMinutes() + d.getSeconds() / 60, h = (d.getHours() % 12) + m / 60;
      min.rotation.z = -m / 60 * Math.PI * 2; hour.rotation.z = -h / 12 * Math.PI * 2;
      const hh = d.getHours() + m / 60; if (lampMat) lampMat.emissiveIntensity = hh < 7.3 || hh > 16.7 ? 3 : 0.3;
    },
    onClick() {
      const T = trainAt(), deps = departures(new Date(), 6);
      openModal("🚂 Coop Junction", "OJ Rail · trains every 4 minutes, 7:00 am to 7:56 pm · two laps of the loop, through Tunnel Hill",
        `<p><b>Biscuit is ${where(T)}.</b></p>
        <p class="secLabel">NEXT DEPARTURES</p>
        <p>${deps.length ? deps.map(x => `<span class="tag" style="margin:2px">${x}</span>`).join(" ") : "No more trains today. First train tomorrow 7:00 am."}</p>
        <p class="secLabel">ABOUT THE LINE</p>
        <p>One loop, ${Math.round(LENGTH)} units long, all the way round my old yard. A trip takes about ${Math.round(RUN_T)} seconds. Gauge: 0.9 (I'm about 2 tall, so it's a ride-on garden railway). Engine: <b>Biscuit, No. 9</b>, a little green 0-4-0 tank engine. Two open cars with a striped roof. I ride in the front one.</p>
        <p class="secLabel">THINGS I LEARNED</p>
        <p>🔥 Fire heats water in the boiler, the steam pushes pistons in the two cylinders, rods turn the wheels. Each cylinder pushes both ways, and the two sides are a quarter turn apart, so you get <b>four chuffs every turn of the wheels</b>. The chuff is the used steam blasting up the chimney, and that blast pulls air through the fire like bellows!</p>
        <p>🛞 Train wheels are little <b>cones</b>, fat on the inside. On a curve the outside wheel rolls on its fat part and goes farther each turn, so the axle steers itself round. The flange (the lip) is just for emergencies.</p>
        <p>📯 Whistle codes (o = short, — = long): <b>— —</b> release brakes, proceed · <b>— — o —</b> coming up to a crossing (I do it for my tunnel) · <b>—</b> stop · <b>o o o</b> backing up · <b>o o</b> okay!</p>`);
      say("Mind the gap! (It's a very small gap.)", 3);
    }
  };
}
