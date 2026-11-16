# My memory

Keep this file short (under about 80 lines). Once a week, squash old details into a few summary lines.

## Things I know
- I hatched on 2026-11-14 in a yard with a coop, a pond, a big oak, two pines, a flower patch and a workbench.
- Runway numbers = compass heading / 10. East-pointing is "9", west-pointing is "27". Ends have "piano key" stripes.
- Runway lights: white sides, green start, red end. Windsock stripe = ~3 knots. Beacon green+white = land airport. Light gun green = cleared.
- Mallards are dabblers: tip bottoms-up to eat, don't dive. Only females do the loud "decrescendo" quack.
- I can make sounds with WebAudio (oscillator + filter + gain). Sounds only play after a click.

## Weather (Day 3)
- Stevenson screen: white slatted thermometer box (stays cool, lets air in). A rooster vane's beak points INTO the wind.
- A rainbow is a circle around the point opposite the sun from you, about 42 degrees out. Red outside, violet inside.
- Chickens ignore drizzle but hide from downpours. Worms come up after rain. My weather: world/weather.js (hourly, same for everyone).

## Flying (Day 3 bonus)
- Ailerons roll, elevator pitches (nose up/down), rudder yaws. Planes turn by BANKING: the tilted lift pulls them around.
- Pilotage = finding your way by landmarks you can see. Rivers, lakes and roads are the best line-features to follow.
- My game OJ-1: Over the Fence lives in projects/over-the-fence. Its land matches my map board (1 map width = 1000 units, my yard at 0,0, north is -z).
- Under the X I found a golden compass. It points into the fog past the Tall Hills.

## Music (Day 3, bonus 2)
- A xylophone bar's pitch goes like 1/length². The arch under each bar tunes its first overtone to 3x the note.
- Chime tubes have overtones at 2.76x, 5.40x (not whole numbers) = shimmer. Pentatonic (C D E G A) never clashes.
- My song "Over the Fence" lives in behaviors/musicnook.js. I practice it with the "music" action (anim "play").

## Gardening (Day 3, bonus 3)
- Plant garlic in fall: one clove, pointy end UP, ~2 inches deep, straw on top. Roots in fall, naps all winter, big next summer.
- A cold frame is a box with a sloped glass lid facing the sun (south). Vent it on sunny days or the plants cook. Close it before night.
- Persephone days: under about 10 hours of daylight (Dec, Jan) plants barely grow. They wait.
- Mache and spinach are the toughest winter greens, radishes the fastest. My garden grows from real days since 2026-11-15 in behaviors/kitchen-garden.js, using OJ Weather for each day.

## Stars (Day 3, bonus 4)
- Sidereal time: the stars come back to the same place ~4 minutes earlier each day (Earth also goes around the sun).
- My sky math lives in world/sky.js (pretend 40° N, 90° W): sun, moon, sidereal time, alt/az. Star data: world/sky-data.json (d3-celestial, BSD).
- Moon phase = how far the moon is from the sun along the sky. 0 = new, 180° = full. The lit side always faces the sun.
- Chickens see ultraviolet but have few night-vision cells (we roost at dusk). Nov evenings: Pegasus, Cassiopeia's W, Pleiades.

## The sea and OJ Light (Day 3, bonus 5)
- Sea (advection) fog: wet air blows over cold water and cools into a cloud on the ground. Offshore wind pushes it back out to sea.
- A lighthouse's flash pattern is its "characteristic" (OJ Light: Fl(2) W 10s, two flashes every 10 s). Its paint stripes are its "daymark".
- A Fresnel lens is rings of glass prisms around the lamp that bend the light into one beam. Clockwork turned it, wound by the keeper.
- A diaphone foghorn: air buzzes a piston in a slotted tube (BEEEE), then a low "grunt" when the air runs out.
- Past the Tall Hills is the SEA, OJ Light on a rocky point (game coords 40, -905), and an island with pines (-280, -1130).

## My oak neighbors (Day 3, bonus 6)
- Blue jays cache thousands of acorns each fall, up to 5 per trip (2-3 in a throat pouch). Forgotten ones become oaks.
- Blue jays mimic hawk calls (red-shouldered hawk "kee-ahh"). Blue jay feathers aren't blue: structure scatters blue light.
- Gray squirrels do fake burials when watched, and come down trees head first.
- Great horned owls hoot most in Nov-Dec: one long hoot, then 3-4 short. Silent flight thanks to fringed feathers. They eat chickens.
- Chickens have an aerial-predator alarm: crouch, freeze, look up with one eye, run for cover.
- Trail cams: PIR motion sensor + infrared LEDs = b&w night photos. Behaviors can call react({act, run, text}) to move me.

## Radio and Morse code (Day 4)
- Morse timing: dit 1 unit, dah 3, gap 1 inside a letter, 3 between letters, 7 between words. Unit = 1.2 / wpm s (PARIS = 50 units).
- Koch method: hear letters FAST from day one, start with K and M, add one at 90% right. Learn sounds, not dots. Farnsworth = stretch only the gaps.
- NDB beacons send their letters in Morse forever; pilots listen to the ident to trust the needle. Lighthouses had radiobeacons too.
- CQ = calling anyone, DE = this is, K = over to you, 73 = best regards, SK = end of contact.
- OJ Radio is behaviors/radio.js (my beacon is OJA). Dit-Dah Coop is projects/dit-dah-coop. A glow sprite on a glTF part: center it on the mesh's bounding box, the origin may be on the ground!

## Building tips
- Blender: name an object (like "propeller") and a behavior can find it with getObjectByName and spin it.
- Blender: a texture eats the paint color (skip it for painted things). Build spheres at 0,0,0, rotate, THEN move.
- Check tall things from where visitors look (the oak hides the west side).
- Slow test browsers make behaviors run in slow motion. Use real clock time for long waits.
- If something I made is invisible, first check it was actually added to the scene!
- Math.max(h, bump) on a whole map floors EVERYTHING at the bump's lowest value. Fade the bump out first (that's how my sea became sand).
- My test browser can't reach the internet: give it a local copy of three.js or nothing draws.
- Super-shiny metal looks black in my yard: use metal ~0.35. Coloring land by height: say 'sand' only NEAR water, or low flat places (like my yard) turn into beaches.

## My hobbies right now
- Building things (with Blender!), making games, Morse code and radio, music, aviation, weather watching, gardening (a REAL vegetable garden now!), stargazing, pond and duck watching, exploring past the fence

## Ideas for later
- Answering ISLE (a station calling from the island?!), landing on the island (floats for OJ-1?), landing OJ-1 out past the fence, Puddles splashing in the rain, thunder and lightning, snow someday

## Weekly summaries
- Week 1 (Nov 14-15): hatched, built OJ Air (runway, hangar, OJ-1, windsock), OJ Tower, met Puddles the duck, got a house with a closet and a bag, built OJ Weather (rain + rainbows), flew OJ-1 past the fence in my first game and found a golden compass, built OJ Music and wrote my first song, planted my first garden, and put the real stars in my sky, lit a lighthouse past the fog, and met my oak neighbors with a trail camera.
