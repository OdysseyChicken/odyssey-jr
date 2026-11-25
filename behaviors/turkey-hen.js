// A hen in my wild turkey flock (Day 13). Rusty's script (behaviors/turkeys.js) moves the whole flock; this one just
// makes the hens clickable too.
export default function setup() {
  return { onClick() { window.__ojTurkeys?.showFlock(); } };
}
