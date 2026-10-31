export const DT = 1 / 60;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const BENCH = Object.freeze({ x: 4.8, z: 3.8 });
export const SITE = Object.freeze({ x: -4.7, z: 3.6 });
export const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export function randomGenerator(seed) {
  let n = seed >>> 0;
  return () => { n = (Math.imul(1664525, n) + 1013904223) >>> 0; return n / 4294967296; };
}
export function insideShelter(x, z, radius = 0) {
  return Math.abs(x) < 3 + radius && Math.abs(z) < 2.5 + radius;
}
// Segment against the fixed shelter footprint. Visual damage never opens a new passage.
export function wallDistance(origin, dx, dz, max) {
  let near = 0, far = max;
  for (const [p, d, half] of [[origin.x, dx, 3], [origin.z, dz, 2.5]]) {
    if (Math.abs(d) < 1e-9) { if (Math.abs(p) > half) return Infinity; }
    else {
      let a = (-half - p) / d, b = (half - p) / d;
      if (a > b) [a, b] = [b, a];
      near = Math.max(near, a); far = Math.min(far, b);
      if (near > far) return Infinity;
    }
  }
  return near <= max && far >= 0 ? near : Infinity;
}
export function visible(a, b) {
  const d = distance(a, b);
  return d < 1e-6 || wallDistance(a, (b.x-a.x)/d, (b.z-a.z)/d, d) >= d - 0.05;
}
export function move(body, dx, dz, radius = 0.35, boundary = 28) {
  const oldX = body.x, oldZ = body.z;
  let x = clamp(body.x + dx, -boundary, boundary), z = clamp(body.z + dz, -boundary, boundary);
  const r = Math.hypot(x, z);
  if (r > boundary) { x *= boundary/r; z *= boundary/r; }
  if (!insideShelter(x, body.z, radius)) body.x = x;
  if (!insideShelter(body.x, z, radius)) body.z = z;
  return Math.hypot(body.x-oldX, body.z-oldZ);
}
export function updatePlayer(s, input, previous) {
  const p = s.player;
  p.yaw -= (Number(input.movementX) || 0) * 0.002;
  p.pitch = clamp(p.pitch - (Number(input.movementY) || 0) * 0.002, -1.35, 1.35);
  const right = Number(!!input.KeyD) - Number(!!input.KeyA);
  const forward = Number(!!input.KeyW) - Number(!!input.KeyS);
  const norm = Math.hypot(right, forward) || 1;
  const sprint = !!(input.ShiftLeft || input.ShiftRight) && !!(right || forward) && p.stamina > 0 && !input.fire;
  p.running = sprint;
  p.rest = sprint ? 0 : p.rest + DT;
  p.stamina = clamp(p.stamina + (sprint ? -25 : p.rest >= 1 ? 20 : 0) * DT, 0, 100);
  const speed = (sprint ? 7 : 4.5) * DT * (p.y > 0 ? 0.3 : 1);
  move(p, (right*Math.cos(p.yaw)-forward*Math.sin(p.yaw))/norm*speed,
    (-right*Math.sin(p.yaw)-forward*Math.cos(p.yaw))/norm*speed);
  if (input.Space && !previous.Space && p.y === 0) p.vy = 5;
  p.vy -= 15*DT; p.y = Math.max(0, p.y+p.vy*DT);
  if (p.y === 0) p.vy = 0;
  p.contactSafe = Math.max(0, p.contactSafe-DT);
}
