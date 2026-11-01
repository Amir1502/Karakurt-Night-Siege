import { DASH } from '../data/dash.js';
import { obstacles, obstacleAt, obstacleDistance, resolveObstacleOverlap } from './obstacles.js';

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
export function visible(a, b, s) {
  const d = distance(a, b);
  if(d<1e-6)return true;
  if(wallDistance(a,(b.x-a.x)/d,(b.z-a.z)/d,d)<d-.05)return false;
  if(!s)return true;
  const y=(a.y??0)+(a.height??1.65),endY=(b.y??0)+(b.height??1.65);
  return obstacleDistance(s,{x:a.x,y,z:a.z},{x:(b.x-a.x)/d,y:(endY-y)/d,z:(b.z-a.z)/d},d)>=d-.05;
}
export function move(body, dx, dz, radius = 0.35, boundary = 28, s) {
  const oldX = body.x, oldZ = body.z;
  if(obstacles(s).length){
    resolveObstacleOverlap(s,body,radius);
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.15));
    for(let i=0;i<steps;i++){
      let x=clamp(body.x+dx/steps,-boundary,boundary),z=clamp(body.z+dz/steps,-boundary,boundary),r=Math.hypot(x,z);
      if(r>boundary){x*=boundary/r;z*=boundary/r;}
      if(!insideShelter(x,body.z,radius)&&!obstacleAt(s,x,body.z,radius,body.y??0))body.x=x;
      if(!insideShelter(body.x,z,radius)&&!obstacleAt(s,body.x,z,radius,body.y??0))body.z=z;
    }
    return Math.hypot(body.x-oldX,body.z-oldZ);
  }
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
  p.dashCooldown=Math.max(0,(p.dashCooldown??0)-DT);
  p.dashTime??=0;
  if(input.KeyC&&!previous.KeyC&&!p.dashTime&&p.dashCooldown<1e-9&&p.y===0&&p.vy===0&&(right||forward)&&p.stamina>=DASH.cost){
    p.stamina-=DASH.cost;p.dashTime=DASH.duration;p.dashCooldown=DASH.cooldown;
    p.dashX=(right*Math.cos(p.yaw)-forward*Math.sin(p.yaw))/norm;
    p.dashZ=(-right*Math.sin(p.yaw)-forward*Math.cos(p.yaw))/norm;
  }
  const dashing=p.dashTime>0;
  const sprint = !dashing && !!(input.ShiftLeft || input.ShiftRight) && !!(right || forward) && p.stamina > 0 && !input.fire;
  p.running = sprint;
  p.rest = sprint || dashing ? 0 : p.rest + DT;
  p.stamina = clamp(p.stamina + (sprint ? -25 : !dashing && p.rest >= 1 ? 20 : 0) * DT, 0, 100);
  if(dashing){
    const elapsed=Math.min(DT,p.dashTime),speed=DASH.distance/DASH.duration;
    const moved=move(p,p.dashX*speed*elapsed,p.dashZ*speed*elapsed,.35,28,s);
    p.dashTime=Math.max(0,p.dashTime-elapsed);
    if(p.dashTime<1e-9||moved<1e-9)p.dashTime=0;
  } else {
    const speed = (sprint ? 7 : 4.5) * DT * (p.y > 0 ? 0.3 : 1);
    move(p, (right*Math.cos(p.yaw)-forward*Math.sin(p.yaw))/norm*speed,
      (-right*Math.sin(p.yaw)-forward*Math.cos(p.yaw))/norm*speed,.35,28,s);
  }
  if (input.Space && !previous.Space && p.y === 0 && !dashing) p.vy = 5;
  p.vy -= 15*DT; p.y = Math.max(0, p.y+p.vy*DT);
  resolveObstacleOverlap(s,p,.35);
  if (p.y === 0) p.vy = 0;
  p.contactSafe = Math.max(0, p.contactSafe-DT);
}
