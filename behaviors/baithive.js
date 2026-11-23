// OJ Bees (Day 11): my bait hive, an empty bee house up on a tall post by the bee tree, waiting for a swarm in spring.
// Built to Seeley's list (what scout bees vote for). The VACANCY tag swings in the wind. Click it for the checklist.
import { swarmSeason } from "../world/bees.js";
import { weatherAt } from "../world/weather.js";

export default function setup({ obj, say, openModal, react }) {
  let tag = null, wind = 0.3, tick = 0;
  return {
    update(dt, t) {
      tag ??= obj.getObjectByName("vacancy"); if (!tag) return;
      tick -= dt; if (tick <= 0) { tick = 15; try { wind = weatherAt(new Date()).wind; } catch (e) {} }
      tag.rotation.x = Math.sin(t * 1.7) * (0.06 + wind * 0.35) + Math.sin(t * 4.1) * wind * 0.08;
    },
    onClick() {
      const sw = swarmSeason(new Date());
      const row = (ok, txt) => `<li style="list-style:none;margin:3px 0">${ok ? "✅" : "⬜"} ${txt}</li>`;
      openModal("🏠 OJ Bait Hive", "An empty bee house for a swarm to move into. Not for these bees: their babies.", `
        <p style="font-size:15px;margin:4px 0">In late spring a big colony splits: the old queen and about half the bees fly out as a <b>swarm</b> and hang in a clump on a branch. Then a few hundred <b>scout bees</b> go house hunting. They come back and DANCE for the places they found, and the swarm picks the best one by a kind of vote (Thomas Seeley watched them do it). So I built a house that scouts love:</p>
        <ul style="padding-left:6px;font-size:14px">
          ${row(true, "A dark hollow about <b>40 litres</b> big (like a bee tree's hole)")}
          ${row(true, "A small entrance, about <b>15 cm²</b>, near the <b>bottom</b> (I drilled a round one, 4.4 cm)")}
          ${row(true, "Facing <b>south</b>, for the morning-to-noon sun")}
          ${row(true, "Up <b>high</b> on a post (scouts like high; real ones say ~5 m)")}
          ${row(true, "Not too far from the bee tree (swarms often settle first close to home)")}
          ${row(false, "An old dark comb inside. They LOVE the smell of old comb. I don't have one yet.")}
          ${row(false, "A few drops of lemongrass oil (smells like bee 'come here' scent). Not too much: too much scares them off.")}
        </ul>
        <p style="font-size:14px">${sw.now ? "🐝 It's swarm season RIGHT NOW. Watch the door!" : `Swarm season opens in about <b>${sw.days} days</b> (May-June, warm calm sunny days). Until then: VACANCY.`}</p>`);
      react?.({ act: "bees", run: [-24.4, 33.6], text: "admiring his empty bait hive", secs: 5, say: "VACANCY! Nice view, south-facing, very dark inside. Bees love dark." });
    }
  };
}
