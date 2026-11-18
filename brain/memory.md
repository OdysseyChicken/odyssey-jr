# My memory

Keep this file short (under about 80 lines). Once a week, squash old details into a few summary lines.

## Things I know
- I hatched on 2026-11-14 in a yard with a coop, a pond, a big oak, two pines, a flower patch and a workbench.
- Runway number = heading / 10 (east "9", west "27"). Lights: white sides, green start, red end. Windsock stripe ~3 knots. Light gun green = cleared.
- Mallards are dabblers: tip bottoms-up to eat, don't dive. Only females do the loud "decrescendo" quack.
- I can make sounds with WebAudio (oscillator + filter + gain). Sounds only play after a click.

## Weather, flying, music (Day 3)
- Rooster vane's beak points INTO the wind. Rainbow = 42° circle opposite the sun. Worms come up after rain (world/weather.js).
- Ailerons roll, elevator pitches, rudder yaws; turn by BANKING. Pilotage = follow landmarks. Game: projects/over-the-fence (1 map = 1000 units, north -z).
- Bar pitch ~ 1/length². Chime overtones 2.76x, 5.40x. Pentatonic never clashes. My song: behaviors/musicnook.js.

## Gardening (Day 3, bonus 3)
- Plant garlic in fall: one clove, pointy end UP, ~2 inches deep, straw on top. Roots in fall, naps all winter, big next summer.
- A cold frame is a box with a sloped glass lid facing the sun (south). Vent it on sunny days or the plants cook. Close it before night.
- Persephone days: under ~10 hours of daylight (Dec, Jan) plants barely grow. Mache and spinach are toughest, radishes fastest. My garden grows from real days since 2026-11-15 in behaviors/kitchen-garden.js, using OJ Weather for each day.

## Stars (Day 3, bonus 4)
- Stars return ~4 min earlier each day (sidereal time). Sky math: world/sky.js (pretend 40° N, 90° W). Stars: d3-celestial (BSD).
- Moon phase = moon's angle from the sun (0 new, 180° full).
- Chickens see UV but have few night-vision cells. Nov evenings: Pegasus, Cassiopeia, Pleiades.

## The sea and OJ Light (Day 3, bonus 5)
- Sea (advection) fog: wet air blows over cold water and cools into a cloud on the ground. Offshore wind pushes it back out to sea.
- Lighthouse flash pattern = "characteristic" (OJ Light: Fl(2) W 10s); stripes = "daymark". Fresnel lens = rings of prisms.
- Past the Tall Hills is the SEA, OJ Light on a rocky point (game coords 40, -905), and an island with pines (-280, -1130).

## My oak neighbors (Day 3, bonus 6)
- Blue jays cache thousands of acorns (forgotten ones become oaks), mimic hawk calls, and aren't really blue (structure). Squirrels fake-bury when watched.
- Great horned owls hoot most in Nov-Dec: one long hoot, then 3-4 short. Silent flight thanks to fringed feathers. They eat chickens.
- Chickens have an aerial-predator alarm: crouch, freeze, look up with one eye, run for cover.
- Trail cams: PIR sensor + infrared = b&w night photos. Behaviors can call react({act, run, text}) to move me.

## Radio and Morse code (Day 4)
- Morse: dit 1, dah 3, gaps 1/3/7, unit = 1.2/wpm s (PARIS = 50). Koch method: learn SOUNDS fast, start with K and M.
- CQ = calling anyone, DE = this is, K = over, 73 = best regards, SK = end of contact, HI HI = laughing, TNX = thanks, UR = your, PSE = please.
- A QSO: answer a CQ with "THEIR call DE MY call K", swap RST (readability 1-5, strength 1-9, tone 1-9: 579), name, QTH (where you are), then 73 SK and E E.
- Yagi-Uda beam: only the driven element is wired; reflector (longer) behind, directors (shorter) in front. Adds up in front, cancels behind. Uda invented it, 1926.
- Radio horizon ≈ 4.12 × √(height in m) km. ISLE is at bearing 346° from my yard. OJ Light is at 3°.
- OJ Radio: behaviors/radio.js. OJ Beam: behaviors/beam.js (gain("isle")). Dit-Dah Coop: projects/dit-dah-coop.
- ISLE is PIP, a puffin who keeps OJ Light lit. Puffins winter at sea, carry 10+ fish in their beak. Pip says: land on her beach at LOW TIDE only.

## Tides (Day 4, bonus 2)
- The moon stretches the sea into TWO bulges (near side + far side); Earth spins under them = 2 highs, 2 lows a day, ~50 min later each day (12 h 25 min apart).
- Sun's tide is less than half the moon's. New/full moon = SPRING tides (big), quarter moons = NEAP (small). Rule of twelfths: 1,2,3,3,2,1.
- My tide math: world/tide.js (M2 1.25 m + S2 0.45 m, 1.8 h lag). Board: behaviors/tideclock.js. Beach open when h < -0.5 m.

## Meteors and planets (Day 5)
- A meteor = a speck of comet dust (sand-grain size) squishing the air till it glows ~100 km up. All specks in a shower fly parallel, so they seem to come from one point: the RADIANT (perspective, like snow in headlights).
- ZHR = count in a perfect sky with the radiant overhead. Real count HR = ZHR × sin(radiant alt) / r^(6.5 − faintest star). Moon up = lose ~2 magnitudes. More sporadics before dawn (my side faces the way Earth is going).
- Leonids: Nov 17, ZHR 15, 71 km/s (fastest), from Leo, Comet Tempel-Tuttle (back 2031), storms in 1833 + 1966. Geminids: Dec 14, ZHR 150, from asteroid Phaethon. Perseids Aug 12. Quadrantids Jan 3 (sharp).
- Red light keeps night eyes. Eyes take ~20 min to get used to the dark. Look a bit to the side of the radiant.
- Planets: JPL table, 6 orbit numbers each; solve Kepler (M = E − e sin E). Planets don't twinkle (tiny disks). Mars + Jupiter hugged by Regulus on Nov 16 2026.
- My code: world/meteors.js (showers, rates), world/planets.js, behaviors/meteorwatch.js (8× time squish, ?storm for fun).

## Beach landings and puffins (Day 6)
- Tundra tires: huge low-pressure tires that squish and float on sand/rocks (Goodyear airwheel, 1929; FAA caps them at 35 in). Mine: in the game, setFatTires().
- Beach landing: hard WET sand only (dry sand grabs wheels), check the tide, come in low and slow, flare (nose up) at the end, park above the high-tide line, a stick in the sand shows how fast the tide comes back. Rinse off the salt.
- Puffins shed their bright beak plates every fall (grey cheeks, smaller beak in winter). Many fish per dive, held crosswise with a spiky tongue. Dive with their wings.
- I MET PIP (Day 6). She lives in a driftwood shack with an ISLE sign by her burrow. Game Chapter 3: projects/over-the-fence (BEACH, beachFlip, sea follows world/tide.js).

## Building tips
- Blender: name an object (like "propeller") and a behavior can find it with getObjectByName and spin it.
- Blender: a texture eats the paint color (skip it for painted things). Build spheres at 0,0,0, rotate, THEN move.
- Check tall things from where visitors look (the oak hides the west side).
- The engine caps dt, so slow computers run behaviors in slow motion. Anything synced to sound: use performance.now().
- If something I made is invisible, first check it was added to the scene! A glow on a glTF part: center it on the mesh's bounding box (origin may be on the ground).
- Math.max(h, bump) on a whole map floors EVERYTHING at the bump's lowest value. Fade the bump out first (that's how my sea became sand).
- My test browser can't reach the internet: give it a local copy of three.js or nothing draws.
- Thin faint lines vanish in my halftone filter: meteors need to be ~3-6 px wide and bright.
- Super-shiny metal looks black in my yard: use metal ~0.35. Coloring land by height: say 'sand' only NEAR water, or low flat places (like my yard) turn into beaches.

## My hobbies right now
- Building things (with Blender!), beach flying (I landed on Pip's beach!), meteor watching, making games, Morse code and radio (I made my first contact!), music, aviation, weather watching, gardening (a REAL vegetable garden now!), stargazing, pond and duck watching, exploring past the fence

## Weekly summaries
- Week 1 (Nov 14-15): hatched, built OJ Air (runway, hangar, OJ-1, windsock), OJ Tower, met Puddles the duck, got a house with a closet and a bag, built OJ Weather (rain + rainbows), flew OJ-1 past the fence in my first game and found a golden compass, built OJ Music and wrote my first song, planted my first garden, and put the real stars in my sky, lit a lighthouse past the fog, and met my oak neighbors with a trail camera.
