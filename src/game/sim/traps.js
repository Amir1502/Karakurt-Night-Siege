import { distance, insideShelter } from './physics.js';
import { damageSpider } from './combat.js';

export const TRAP = Object.freeze({ cost:35, limit:3, clearance:2, spacing:1.5, radius:.8, damage:30, stun:2, heavyStun:1, effectTime:.6 });

export function placementOffer(s) {
  const p=s.player;
  let reason='';
  if(s.phase!=='build'||s.subphase!=='build')reason='Установка только в подготовке';
  else if(!s.trapStock)reason='Сначала купите капкан: T у верстака';
  else if(p.y>0||p.vy!==0)reason='Для установки встаньте на землю';
  else if(insideShelter(p.x,p.z)||Math.hypot(Math.max(0,Math.abs(p.x)-3),Math.max(0,Math.abs(p.z)-2.5))<TRAP.clearance)reason='Отойдите на 2 м от стен шалаша';
  else if(s.traps.some(t=>distance(p,t)<TRAP.spacing))reason='Отойдите на 1,5 м от другого капкана';
  return {kind:'placeTrap',cost:0,amount:1,ok:!reason,reason};
}

export function placeTrap(s) {
  const o=placementOffer(s);s.lastAction={...o,tick:s.tick};
  if(!o.ok)return;
  s.trapStock--;s.traps.push({id:++s.trapSerial,x:s.player.x,z:s.player.z,yaw:s.player.yaw});
}

export function triggerTraps(s) {
  for(const trap of s.traps) {
    // Stable ids resolve overlapping candidates independently of render/array order.
    const e=s.spiders.filter(e=>e.health>0&&e.y===0&&e.state!=='jump'&&distance(e,trap)<=TRAP.radius).sort((a,b)=>a.id-b.id)[0];
    if(!e)continue;
    damageSpider(s,e,TRAP.damage,'trap');
    e.stun=['tarantula_brute','widow_queen'].includes(e.spiderId)?TRAP.heavyStun:TRAP.stun;
    e.state='trapped';e.timer=0;e.attack=null;e.cooldown=0;
    s.trapEffects.push({...trap,until:s.time+TRAP.effectTime});
  }
  const spent=new Set(s.trapEffects.map(t=>t.id));
  s.traps=s.traps.filter(t=>!spent.has(t.id));
}
