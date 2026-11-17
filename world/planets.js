// OJ Stars, Stage 2 (Day 5): where the planets really are tonight.
// JPL's "approximate positions of the planets" (Table 1, good from 1800 to 2050): each planet's orbit is six numbers
// (a, e, I, L, long. of perihelion, long. of node) that slowly change. Solve Kepler's equation, rotate the ellipse into
// place, then look from the Earth instead of from the Sun. Good to a fraction of a degree. Plenty for a chicken.
//   planetsAt(date) -> [{ id, name, ra, dec, mag, dist, color }]   (degrees, magnitude, distance from Earth in au)
const D = Math.PI / 180;
const EL = {
  mercury: [0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749, 252.25032350, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081],
  venus:   [0.72333566, 0.00000390, 0.00677672, -0.00004107, 3.39467605, -0.00078890, 181.97909950, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418],
  earth:   [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0, 0],
  mars:    [1.52371034, 0.00001847, 0.09339410, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343],
  jupiter: [5.20288700, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714, 34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106],
  saturn:  [9.53667594, -0.00125060, 0.05386179, -0.00050991, 2.48599187, 0.00193609, 49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794]
};
// H = how bright it would be 1 au from both Sun and Earth (rough, no phase or rings), and a color for my sky
export const PLANETS = [
  { id: "mercury", name: "Mercury", H: -0.4, color: [1.0, 0.88, 0.8] },
  { id: "venus", name: "Venus", H: -4.4, color: [1.0, 0.98, 0.86] },
  { id: "mars", name: "Mars", H: -1.5, color: [1.0, 0.6, 0.38] },
  { id: "jupiter", name: "Jupiter", H: -9.4, color: [1.0, 0.95, 0.82] },
  { id: "saturn", name: "Saturn", H: -8.9, color: [1.0, 0.9, 0.64] }
];
function helio(id, T) {
  const e0 = EL[id], el = k => e0[k * 2] + e0[k * 2 + 1] * T;
  const a = el(0), e = el(1), I = el(2) * D, L = el(3), wbar = el(4), node = el(5);
  const w = (wbar - node) * D, O = node * D;
  let M = ((L - wbar) % 360 + 540) % 360 - 180; M *= D;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I);
  return [
    (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    (sw * sI) * xp + (cw * sI) * yp
  ];
}
export function planetsAt(date) {
  const T = (date.getTime() / 86400000 + 2440587.5 - 2451545.0) / 36525;
  const earth = helio("earth", T), eps = 23.43928 * D;
  return PLANETS.map(p => {
    const h = helio(p.id, T), g = [h[0] - earth[0], h[1] - earth[1], h[2] - earth[2]];
    const x = g[0], y = g[1] * Math.cos(eps) - g[2] * Math.sin(eps), z = g[1] * Math.sin(eps) + g[2] * Math.cos(eps);
    const dist = Math.hypot(x, y, z), r = Math.hypot(...h);
    // phase angle (Sun-planet-Earth): Mercury and Venus get much dimmer when they're a thin crescent near the Sun
    const re = Math.hypot(...earth), i = Math.acos(Math.max(-1, Math.min(1, (r * r + dist * dist - re * re) / (2 * r * dist)))) / D;
    const ph = p.id === "mercury" ? 0.0498 * i - 4.88e-4 * i * i + 3.02e-6 * i ** 3 : p.id === "venus" ? 0.0009 * i + 2.39e-4 * i * i - 6.5e-7 * i ** 3 : p.id === "mars" ? 0.016 * i : 0;
    return { ...p, ra: (Math.atan2(y, x) / D + 360) % 360, dec: Math.asin(z / dist) / D, dist, phase: i, mag: p.H + 5 * Math.log10(r * dist) + ph };
  });
}
