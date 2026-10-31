import { DT, angleDelta, clamp, distance, visible, wallDistance } from './physics.js';
export function damageSpider(s, enemy, amount, source) {
  if (enemy.health <= 0) return 0;
  const applied = Math.min(enemy.health, amount);
  enemy.health -= applied; enemy.aggro = 3; enemy.lastSource = source;
  if (applied > 0 && source === 'player') s.hitSerial++;
  return applied;
}
function rayHit(s, yaw, pitch, range) {
  const p = s.player, dx = -Math.sin(yaw)*Math.cos(pitch), dz = -Math.cos(yaw)*Math.cos(pitch), dy = Math.sin(pitch);
  let best = Math.min(range, wallDistance(p, dx, dz, range)), hit = null;
  for (const e of s.spiders) {
    if (e.health <= 0) continue;
    const x=e.x-p.x, y=e.y+e.height-(p.y+1.65), z=e.z-p.z;
    const along=x*dx+y*dy+z*dz;
    const off=x*x+y*y+z*z-along*along;
    if (along < 0 || off > e.radius*e.radius) continue;
    const entry=Math.max(0, along-Math.sqrt(Math.max(0,e.radius*e.radius-off)));
    if (entry < best) { best=entry; hit=e; }
  }
  return hit ? { enemy: hit, distance: best } : null;
}
function fire(s, w, random) {
  s.shotSerial++; s.lastShot = { slot:s.activeSlot, time:s.time };
  if (w.id === 'flamethrower_torch') {
    for (const e of s.spiders) {
      const d = distance(s.player,e), angle=Math.atan2(-(e.x-s.player.x), -(e.z-s.player.z));
      if (d <= w.range+e.radius && Math.abs(angleDelta(angle,s.player.yaw)) <= w.spread*Math.PI/180 && visible(s.player,e)) damageSpider(s,e,w.damage,'player');
    }
    return;
  }
  for (let i=0;i<w.pellets;i++) {
    const spread=w.spread*Math.PI/180;
    const hit=rayHit(s,s.player.yaw+(random()-.5)*spread*2,s.player.pitch+(random()-.5)*spread*2,w.range);
    if (!hit) continue;
    let amount=w.damage;
    if (w.id === 'shotgun_trench') amount *= clamp(1-(hit.distance-8)*.6/12,.4,1);
    const e=hit.enemy;
    if (e.spiderId==='widow_queen') {
      const from=Math.atan2(s.player.x-e.x,s.player.z-e.z);
      if (Math.abs(angleDelta(from,e.yaw))>Math.PI*.65) amount*=2;
    }
    damageSpider(s,e,amount,'player');
  }
}
export function updateWeapons(s, config, input, previous, emit, random) {
  for(let i=0;i<5;i++) if(input['Digit'+(i+1)] && s.weapons[i].unlocked && s.activeSlot!==i+1) {
    const fromId=config.weapons[s.activeSlot-1].id;
    s.weapons[s.activeSlot-1].reload=0;
    s.activeSlot=i+1; s.switchTime=.3;
    emit('weapon:switch',{fromId,toId:config.weapons[i].id,slot:i+1});
  }
  s.switchTime=Math.max(0,s.switchTime-DT);
  const i=s.activeSlot-1, a=s.weapons[i], w=config.weapons[i];
  for(const ammo of s.weapons) ammo.cooldown=Math.max(0,ammo.cooldown-DT);
  if(a.reload>0) {
    a.reload=Math.max(0,a.reload-DT);
    if(a.reload===0) { const n=Math.min(w.magazine-a.magazine,a.reserve); a.magazine+=n; a.reserve-=n; }
  }
  if(input.KeyR && !previous.KeyR && !a.reload && a.reserve && a.magazine<w.magazine && i<4) { a.reload=w.reloadTime; s.reloadSerial++; }
  const automatic=i===2||i===3;
  if(s.phase==='wave' && input.fire && (automatic||!previous.fire) && i<4 && !a.reload && !s.switchTime && a.cooldown<=0 && a.magazine>0) {
    a.magazine--; a.cooldown=1/w.fireRate; fire(s,w,random);
  }
  const turret=s.turrets[0], ta=s.weapons[4], tw=config.weapons[4];
  if(!turret || s.phase!=='wave') return;
  if(turret.reload>0) {
    turret.reload=Math.max(0,turret.reload-DT);
    if(!turret.reload) { const n=Math.min(tw.magazine-ta.magazine,ta.reserve); ta.magazine+=n; ta.reserve-=n; }
    return;
  }
  if((!ta.magazine || input.KeyR&&!previous.KeyR&&i===4&&distance(s.player,turret)<=2.5) && ta.reserve) { turret.reload=tw.reloadTime; return; }
  const targets=s.spiders.filter(e=>e.health>0 && distance(turret,e)<=tw.range && visible(turret,e));
  targets.sort((a,b)=>Number(b.target==='shelter')-Number(a.target==='shelter') || distance(turret,a)-distance(turret,b));
  const e=targets[0]; if(!e) return;
  const desired=Math.atan2(e.x-turret.x,e.z-turret.z), delta=angleDelta(desired,turret.yaw);
  turret.yaw+=clamp(delta,-Math.PI*DT,Math.PI*DT);
  if(Math.abs(delta)<.08 && !ta.cooldown && ta.magazine) {
    ta.magazine--;ta.cooldown=1/tw.fireRate;damageSpider(s,e,tw.damage,'turret');s.turretShotSerial++;
  }
}
