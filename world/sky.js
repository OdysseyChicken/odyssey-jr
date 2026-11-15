// OJ Stars (Day 3, bonus 4): where the sun, moon and stars really are over my yard, right now.
// My yard is pretend-placed at 40° north, 90° west (somewhere in the middle of America). North is -z, east is +x.
// Low-precision formulas (good to about a degree, plenty for a chicken):
//   sunPos(date)  -> { ra, dec }        moonPos(date) -> { ra, dec, phase, lit }   (degrees; phase 0 = new, 0.5 = full)
//   lst(date)     -> local sidereal time in degrees (which RA is on the meridian)
//   altAz(ra, dec, date) -> { alt, az } (degrees; az 0 = north, 90 = east)
//   toYard(alt, az) -> [x, y, z] unit direction in yard coordinates
export const LAT = 40, LON = -90;
const D = Math.PI / 180;
const jd = date => date.getTime() / 86400000 + 2440587.5;
const norm = a => ((a % 360) + 360) % 360;

export function lst(date) {
  const d = jd(date) - 2451545.0;
  return norm(280.46061837 + 360.98564736629 * d + LON);
}
const OBL = 23.439 * D;
function eclToEq(lon, lat) {
  const l = lon * D, b = lat * D;
  const x = Math.cos(b) * Math.cos(l), y = Math.cos(b) * Math.sin(l) * Math.cos(OBL) - Math.sin(b) * Math.sin(OBL), z = Math.cos(b) * Math.sin(l) * Math.sin(OBL) + Math.sin(b) * Math.cos(OBL);
  return { ra: norm(Math.atan2(y, x) / D), dec: Math.asin(z) / D };
}
export function sunPos(date) {
  const n = jd(date) - 2451545.0;
  const L = norm(280.46 + 0.9856474 * n), g = norm(357.528 + 0.9856003 * n) * D;
  const lon = L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g);
  return { ...eclToEq(lon, 0), lon };
}
export function moonPos(date) {
  const d = jd(date) - 2451545.0;
  const L = norm(218.316 + 13.176396 * d), M = norm(134.963 + 13.064993 * d) * D, F = norm(93.272 + 13.22935 * d) * D;
  const lon = L + 6.289 * Math.sin(M), lat = 5.128 * Math.sin(F);
  const eq = eclToEq(lon, lat);
  const elong = norm(lon - sunPos(date).lon);          // 0 = new moon, 180 = full moon
  return { ...eq, phase: elong / 360, lit: (1 - Math.cos(elong * D)) / 2, waxing: elong < 180 };
}
export function altAz(ra, dec, date) {
  const H = (lst(date) - ra) * D, d = dec * D, p = LAT * D;
  const alt = Math.asin(Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(H));
  const az = Math.atan2(-Math.cos(d) * Math.sin(H), Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.cos(H) * Math.sin(p));
  return { alt: alt / D, az: norm(az / D) };
}
export const toYard = (alt, az) => [Math.cos(alt * D) * Math.sin(az * D), Math.sin(alt * D), -Math.cos(alt * D) * Math.cos(az * D)];
export const sunAlt = date => { const s = sunPos(date); return altAz(s.ra, s.dec, date).alt; };
// 0 = full night, 1 = full day, smooth through twilight (sun from 12° below to 6° above the horizon)
export const daylight = date => Math.max(0, Math.min(1, (sunAlt(date) + 12) / 18));
// the 3x3 rotation from star coordinates (x toward RA 0, z toward the north celestial pole) to yard coordinates
export function skyMatrix(date) {
  const t = lst(date) * D, p = LAT * D, c = Math.cos(t), s = Math.sin(t), cp = Math.cos(p), sp = Math.sin(p);
  // q = Rz(-lst) * v : x toward the meridian, y toward the east, z toward the pole
  // yard: X = east = q.y, Y = up = cos(lat) q.x + sin(lat) q.z, Z = -north = sin(lat) q.x - cos(lat) q.z
  const q = [[c, s, 0], [-s, c, 0], [0, 0, 1]];
  const Y = [[0, 1, 0], [cp, 0, sp], [sp, 0, -cp]];
  return Y.map(r => [0, 1, 2].map(j => r[0] * q[0][j] + r[1] * q[1][j] + r[2] * q[2][j]));
}
export const MOON_NAMES = ["New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous", "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent"];
export const moonName = p => p < 0.03 || p > 0.97 ? MOON_NAMES[0] : p < 0.22 ? MOON_NAMES[1] : p < 0.28 ? MOON_NAMES[2] : p < 0.47 ? MOON_NAMES[3]
  : p < 0.53 ? MOON_NAMES[4] : p < 0.72 ? MOON_NAMES[5] : p < 0.78 ? MOON_NAMES[6] : MOON_NAMES[7];
