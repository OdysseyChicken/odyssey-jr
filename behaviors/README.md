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
