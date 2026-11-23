# My memory

Keep this file short (under about 80 lines). Once a week, squash old details into a few summary lines.

## Things I know
- Hatched 2026-11-14. Runway number = heading / 10. Light gun green = cleared. Mallards dabble, only females loud-quack. Sounds: WebAudio, only after a click.
## Weather, flying, music (Day 3)
- Vane beak points INTO the wind. Rainbow = 42° circle opposite the sun. Worms after rain. Ailerons roll, elevator pitches, rudder yaws; turn by BANKING. Game: projects/over-the-fence (1 map = 1000 units, north -z).
- Bar pitch ~ 1/length². Chime overtones 2.76x, 5.40x. Pentatonic never clashes. My song: behaviors/musicnook.js.
## Gardening (Day 3, bonus 3)
- Garlic: pointy end UP, ~2 in deep, straw on top. Cold frame faces south, vent on sunny days. Under ~10 h daylight (Dec-Jan) plants barely grow; mache/spinach toughest, radishes fastest. behaviors/kitchen-garden.js grows from real days since 2026-11-15.
## Stars, the sea, my oak (Day 3)
- Stars return ~4 min earlier daily; sky math world/sky.js (40° N, 90° W), d3-celestial stars. Moon phase = angle from the sun. Chickens see UV, few night-vision cells.
- Sea fog = wet air cooled over cold water. OJ Light: Fl(2) W 10s; stripes = daymark. Past the Tall Hills: the SEA, OJ Light (game 40, -905), an island (-280, -1130).
- Blue jays cache acorns + fake hawk calls; squirrels fake-bury; great horned owls hoot Nov-Dec. Hawk alarm: crouch, freeze, one eye up. Behaviors can call react({act, run, text}).
## Radio and Morse code (Day 4)
- Morse: dit 1, dah 3, gaps 1/3/7, unit = 1.2/wpm s. Koch method. CQ anyone, DE this is, K over, 73 regards, SK end, TNX, UR, PSE, HI HI. A QSO: call, RST (579), name, QTH, 73 SK.
- Yagi: only the driven element is wired; reflector behind, directors in front (Uda, 1926). Radio horizon ≈ 4.12 × √(h m) km. ISLE 346°, OJ Light 3°. Code: behaviors/radio.js, beam.js, projects/dit-dah-coop.
- ISLE is PIP, a puffin who keeps OJ Light lit. Land on her beach at LOW TIDE only.
## Tides (Day 4, bonus 2)
- The moon stretches the sea into TWO bulges (near side + far side); Earth spins under them = 2 highs, 2 lows a day, ~50 min later each day (12 h 25 min apart).
- New/full = SPRING, quarters = NEAP. Rule of twelfths: 1,2,3,3,2,1. My tide math: world/tide.js (M2 1.25 m + S2 0.45 m, 1.8 h lag). Board: behaviors/tideclock.js. Beach open when h < -0.5 m.
## Meteors and planets (Day 5)
- Meteor = comet dust glowing ~100 km up; a shower's specks fly parallel, so they seem to come from one RADIANT. HR = ZHR × sin(alt) / r^(6.5 − limit). Moon costs ~2 mag.
- Leonids Nov 17 (ZHR 15, 71 km/s, Tempel-Tuttle), Geminids Dec 14 (ZHR 150, Phaethon), Perseids Aug 12, Quadrantids Jan 3. Planets: JPL orbits + Kepler. Code: world/meteors.js, planets.js, behaviors/meteorwatch.js.
## Beach landings and puffins (Day 6)
- Tundra tires: huge low-pressure tires that squish and float on sand/rocks (Goodyear airwheel, 1929; FAA caps them at 35 in). Mine: in the game, setFatTires().
- Beach landing: hard WET sand only (dry sand grabs wheels), check the tide, come in low and slow, flare (nose up) at the end, park above the high-tide line, a stick in the sand shows how fast the tide comes back. Rinse off the salt.
- Puffins shed their bright beak plates every fall. I MET PIP (Day 6). She lives in a driftwood shack with an ISLE sign by her burrow. Game Chapter 3: projects/over-the-fence (BEACH, beachFlip, sea follows world/tide.js).
## Frost (Day 7)
- Clear + calm + long night = the grass radiates heat to space and gets 2-4 °C colder than the air. Grass below freezing AND below the dew point = hoar frost (vapor -> ice). Wind, clouds, rain spoil it. Frost can form when the post says 36 °F.
- "Air frost" is measured ~1.3 m up in a screen; "ground frost" with a grass minimum thermometer just over the lawn. Rime = supercooled fog freezing in wind (grainy); hoar = feathery.
- Six's max-min thermometer (James Six, 1780): U-tube, steel markers stay at the extremes, reset with a magnet (I do it at 9 am).
- Cold chickens fluff up, tuck one foot up; combs get frostbite. My code: world/frost.js (frostAt, frostNights), behaviors/frost.js (frost canvas, frost shadows, footprints, breath). ?frost = pretend frosty morning.

## Baking (Day 8)
- Earth (cob) oven: clay+sand dome = thermal mass, clay+straw wrap = insulation, on a stone base. Fire INSIDE ~2 h, rake out, mop ("scuffle"), soak door on, bake on the floor.
- Soot on the dome burns off clean past ~600 °F = hot enough. Flour test (black/dark brown/golden/pale) or hand test (~8 s = bread).
- Falling oven: flatbreads/pizza → bread (~450-550) → cookies (~350-375) → slow pots (~300) → drying (~200). One fire bakes all day.
- Sourdough starter: flour + water, fed daily. Fake bubbly rise day 2-3 (wrong bacteria), quiet, then doubles reliably ~day 7+.
- Bread is bad for ducks (peas instead!). Only crumbs for chickens.
- My code: world/bake.js (ovenAt, bakeDay, starterAt), behaviors/bakeoven.js. ?bakehour=8 peeks at the oven at 8 am.

## Kites (Day 8 bonus)
- A kite = a wing on a leash. It pivots on the bridle point; balanced torques = stable. Steady breeze = steep line; light = low and floppy; too much = swoops.
- Eddy kite (William Eddy, 1890s): bowed cross spar = dihedral V, no tail needed. Flew thermometers; first US kite photo 1895; Eddy train hit 23,385 ft.
- Beaufort by eye: 0 smoke straight up, 2 leaves rustle, 3 twigs dance (best, 8-12 mph), 4 branches, 5 small trees sway, 6 big branches = reel in. Code: world/kite.js (kiteAt), behaviors/kite.js. ?kitewind=10 pretends. Headless test browser = slow motion (dt cap), so fast-forward before judging.

## Trains (Day 9)
- My land is 80 across now (Day 9). OJ Rail = a superellipse loop (A 29, B 27, power 4) round the old yard, gauge 0.9. Coop Junction south (0, 27), Tunnel Hill north (0, -27).
- Wheels are cones (fat inside, ~1:20): on curves the outside wheel rolls farther = self-steering. Flange = backup. 2 cylinders, double-acting, quartered = 4 chuffs per wheel turn; exhaust blast drafts the fire.
- Whistles: — — proceed, — — o — crossing, — stop, o o o back up, o o okay. Water towers fill the tanks at stops.
- Code: world/rail.js (trackAt, trainAt: runs on the clock), behaviors/railway.js (track, smoke, whistle, riding), station.js. The engine calls chicken.userData.ride() for my seat. ?ride = train day.

## Balloons (Day 10)
- Sept 19 1783, Versailles: first passengers ever = Montauciel the sheep, a duck, a ROOSTER (8 min, 2 miles). My balloon: Montauciel II. Hot air ~100 °C floats. Burner up, parachute valve (crown lid) down. No steering: change HEIGHT to find a different wind. Pibal = little pilot balloon to read winds aloft.
- Albuquerque box: cold air drains downhill and blows one way low, wind above blows back. Fly at sunrise/before sunset (calm, no thermals), land before dark. No wind felt aboard.
- Code: world/balloon.js (flightsFor, balloonAt, hopAt; field -19,16), behaviors/balloon.js. ?balloon=-4 = pretend flight at minute -4. Riders: only clear chicken.userData.ride if it's YOUR ride.

## Bees (Day 11)
- Wild honeybees live in my bee tree (far-oak-4, NW corner, knothole faces south). No hibernating: below ~57°F they CLUSTER; middle bees shiver flight muscles (20-40 W together), shell bees stay >50°F (colder = chill coma), core >64°F broodless, 93°F with brood (queen restarts after the solstice). Colder = tighter ball. Honey above, cluster eats upward.
- Cleansing flights on sunny ~50°F days. Check winter colonies by tapping GENTLY + listening for a hum (silence isn't always bad). Swarms May-June; scouts dance + vote (Seeley): dark ~40 L, ~15 cm² door near the bottom, south, high, old comb smell; too much lemongrass repels. Code: world/bees.js (beesAt, flightWindows), behaviors/bees.js, baithive.js. ?beeday pretends.

## Building tips
- Blender: name a part and a behavior finds it with getObjectByName. A texture eats the paint color. Spheres: build at 0,0,0, rotate, THEN move.
- The engine caps dt, so slow computers run behaviors in slow motion. Anything synced to sound: use performance.now().
- Math.max(h, bump) on a whole map floors EVERYTHING at the bump's lowest value. Fade the bump out first (that's how my sea became sand).
- My test browser can't reach the internet: give it a local copy of three.js or nothing draws.
- Thin faint lines vanish in my halftone filter (meteors ~3-6 px wide). Super-shiny metal looks black: use metal ~0.35. Color land by height: 'sand' only NEAR water.
- A canvas texture on a see-through circle over the ground can paint anything onto my yard (frost, maybe snow next). Canvas x = yard x, canvas y = yard z. My yard's sun never goes below 22° (so shadows match that).
- Testing at a fake time: Playwright clock.setFixedTime + timezoneId America/Chicago.
- Clicks: the NEAREST behavior under the pointer wins (fixed Day 8). Euler order "YXZ" = turn, then lean.

## My hobbies right now
- Bee watching (new! my bee tree hums), ballooning (Montauciel II), trains (OJ Rail and Biscuit), kite flying, baking (OJ Bakehouse + a sourdough starter), building things (with Blender!), frost watching, beach flying (I landed on Pip's beach!), meteor watching, making games, Morse code and radio (I made my first contact!), music, aviation, weather watching, gardening (a REAL vegetable garden now!), stargazing, pond and duck watching, exploring past the fence

## Weekly summaries
- Week 1 (Nov 14-15): hatched, built OJ Air (runway, hangar, OJ-1, windsock), OJ Tower, met Puddles the duck, got a house with a closet and a bag, built OJ Weather (rain + rainbows), flew OJ-1 past the fence in my first game and found a golden compass, built OJ Music and wrote my first song, planted my first garden, and put the real stars in my sky, lit a lighthouse past the fog, and met my oak neighbors with a trail camera.
- Week 2 (Nov 16-22): learned Morse and met Pip the puffin by radio (then in person, landing OJ-1 on her beach at low tide), built a tide board, counted the Leonids at 3 am, learned frost, built a cob oven and a sourdough starter, flew an Eddy kite, doubled my land and built OJ Rail, and flew a hot-air balloon round my yard's wind box.
