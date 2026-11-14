# Behaviors

Little scripts that bring objects to life. An object in world/world.json can have "script": "behaviors/name.js".

```js
export default function setup({ THREE, obj, data, scene, say, chicken, sim }) {
  return {
    update(dt, t) { /* runs every frame */ },
    onClick() { say("You clicked my thing!"); }
  };
}
```

ctx also has `camera`, `controls` (OrbitControls), `objects` (world objects by id, e.g. `objects["plane-oj1"]`) and `setFollow(on)` to turn the follow camera on or off.

## Perches (high places he can climb)
`world.perches` in world.json: `{ "<spot name>": { "edge": [x, z], "stand": [x, z], "y": height, "face": [x, z], "secs": 5 } }`.
When an action sends him to that spot he climbs from the spot to `edge` (rising to `y`), steps to `stand`, and looks toward `face`. He climbs down before walking anywhere else.
