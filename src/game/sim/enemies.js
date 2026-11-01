import { DT, clamp, distance, visible, move, insideShelter } from './physics.js';
import { triggerTraps } from './traps.js';
import { blockingObstacle, detour, obstacleDistance } from './obstacles.js';
import { damageBarricade } from './barricades.js';
import { BROOD } from '../data/nests.js';
const MOD = {karakurt_runner:.2,karakurt_spitter:0,tarantula_brute:.4,jumper_wolf:0,widow_queen:.25};
function damage(s, target, amount, source, kind, emit, direction) {
  if(amount<=0) return;
  if(target==='barricade'){
    const attacker=s.spiders.find(e=>e.id===source),id=attacker?.attack?.barrierId??attacker?.barrierId;
    damageBarricade(s,s.barricades?.find(b=>b.id===id),amount);return;
  }
  if(target==='player') {
    if(kind==='contact'&&s.player.contactSafe>0) return;
    const applied=Math.min(s.player.health,amount);s.player.health-=applied;
    if(s.stats&&applied>0) s.stats.playerDamage+=applied;
    if(kind==='contact') s.player.contactSafe=.35;
    const attacker=s.spiders.find(e=>e.id===source),dx=direction?.x??(attacker?attacker.x-s.player.x:0),dz=direction?.z??(attacker?attacker.z-s.player.z:0),length=Math.hypot(dx,dz);
    emit('player:damage',{amount:applied,health:s.player.health,source,kind,...(length>1e-6?{direction:{x:dx/length||0,z:dz/length||0}}:{})});
  } else {
    const applied=Math.min(s.shelterIntegrity,amount);s.shelterIntegrity-=applied;
    if(s.stats&&applied>0) s.stats.shelterDamage+=applied;
    emit('shelter:damage',{amount:applied,shelterIntegrity:s.shelterIntegrity,source,kind});
  }
}
function spit(s,e,amount) {
  const dx=s.player.x-e.x,dz=s.player.z-e.z,d=Math.hypot(dx,dz)||1;
  s.webs.push({id:`${e.id}:${s.tick}`,x:e.x,y:.7,z:e.z,vx:dx/d*12,vz:dz/d*12,life:5,damage:amount,source:e.id});
}
function approach(e,target,speed,s) {
  const dx=target.x-e.x,dz=target.z-e.z,d=Math.hypot(dx,dz)||1;
  e.yaw=Math.atan2(dx,dz);
  const moved=move(e,dx/d*speed*DT,dz/d*speed*DT,e.radius,40,s);
  // Slide around the solid shelter instead of tunnelling through it.
  if(moved<speed*DT*.1 && d>1) move(e,-dz/d*speed*DT,dx/d*speed*DT,e.radius,40,s);
}
export function updateEnemies(s,config,emit) {
  const slots=new Map();
  for(const e of s.spiders) {
    if(e.health<=0) continue;
    if(e.stun>0) {
      e.stun=Math.max(0,e.stun-DT);if(e.stun<1e-9){e.stun=0;e.state='walk';}continue;
    }
    const base=config.spiders.find(d=>d.id===e.spiderId),def=e.brood?{...base,...BROOD}:base, p=s.player;
    e.cooldown=Math.max(0,e.cooldown-DT);e.aggro=Math.max(0,e.aggro-DT);e.spitCooldown-=DT;
    e.enraged=e.enraged||(def.behavior==='boss'&&e.health<=e.maxHealth*.5);
    const pd=distance(e,p)-e.radius-.35, sight=visible(e,p,s);
    let targetPlayer=def.behavior==='spit'||def.behavior==='leap'||(def.behavior==='chase'&&(e.aggro>0||pd<=10&&sight))||(def.behavior==='boss'&&pd<=15&&sight);
    if(def.behavior==='charge'&&pd<3&&sight) targetPlayer=true;
    e.target=targetPlayer?'player':'shelter';
    const side=Math.abs(e.x/3)>Math.abs(e.z/2.5)?(e.x>0?0:1):(e.z>0?2:3);
    const used=slots.get(side)||0, cost=def.behavior==='boss'?2:1;
    const wallTarget=side<2?{x:(side===0?1:-1)*(3+e.radius),z:used===0?-1.2:1.2}:{x:used===0?-1.5:1.5,z:(side===2?1:-1)*(2.5+e.radius)};
    let target=targetPlayer?p:wallTarget;
    const barrier=blockingObstacle(s,e,target,e.radius);
    e.barrierId=null;
    if(barrier&&s.barricades?.includes(barrier)&&!targetPlayer&&def.behavior!=='leap'){
      e.target='barricade';e.barrierId=barrier.id;e.route=null;
      target={x:clamp(e.x,barrier.x-barrier.halfX-e.radius,barrier.x+barrier.halfX+e.radius),z:clamp(e.z,barrier.z-barrier.halfZ-e.radius,barrier.z+barrier.halfZ+e.radius)};
    } else if(barrier&&def.behavior!=='leap'&&!e.route)e.route=detour(e,target,barrier);
    if(e.route){if(distance(e,e.route[0])<.2)e.route.shift();if(e.route.length)target=e.route[0];else e.route=null;}
    const gap=e.target==='barricade'?distance(e,target):targetPlayer?pd:distance(e,wallTarget);
    const permitted=e.target==='barricade'||targetPlayer||used+cost<=2;
    if(!targetPlayer&&gap<3&&permitted) slots.set(side,used+cost);
    if(def.behavior==='boss'&&e.spitCooldown<=0&&sight) {spit(s,e,16);e.spitCooldown=e.enraged?4:6;}
    if(e.state==='jump') {
      e.timer-=DT; const t=clamp(1-e.timer/.9,0,1);
      const nx=e.attack.fromX+(e.attack.x-e.attack.fromX)*t,nz=e.attack.fromZ+(e.attack.z-e.attack.fromZ)*t;
      e.y=4*t*(1-t)*1.8;move(e,nx-e.x,nz-e.z,e.radius,40,s);
      if(e.timer<=0) {e.y=0;e.state='land';e.timer=.15;e.cooldown=def.attackCooldown;
        triggerTraps(s);if(e.stun>0)continue;
        if(distance(e,p)<=1.2&&visible(e,p,s)) damage(s,'player',def.damage,e.id,'contact',emit);}
      continue;
    }
    if(e.state==='charge') {
      const speed=def.speed*(e.elite?1.2:1);
      const next={x:e.x+e.attack.dx*speed*2.5*DT,z:e.z+e.attack.dz*speed*2.5*DT},contact=blockingObstacle(s,e,next,e.radius);
      e.timer-=DT;move(e,next.x-e.x,next.z-e.z,e.radius,40,s);
      triggerTraps(s);if(e.stun>0)continue;
      if(!e.attack.hit) {
        if(contact&&s.barricades?.includes(contact)){damageBarricade(s,contact,def.damage);e.attack.hit=true;e.timer=0;}
        else if(distance(e,p)-e.radius-.35<=def.attackRange&&visible(e,p,s)&&!blockingObstacle(s,e,p,e.radius)) {damage(s,'player',def.damage,e.id,'contact',emit);e.attack.hit=true;}
        else if(distance(e,wallTarget)<.3&&permitted) {damage(s,'shelter',def.damage*MOD[e.spiderId],e.id,'contact',emit);e.attack.hit=true;}
      }
      if(e.timer<=0) {e.state='walk';e.cooldown=def.attackCooldown;} continue;
    }
    if(e.state==='windup') {
      e.timer-=DT;
      if(e.timer<=0) {
        const a=e.attack;
        if(def.behavior==='charge') {e.state='charge';e.timer=1.2;const d=Math.hypot(a.x-e.x,a.z-e.z)||1;a.dx=(a.x-e.x)/d;a.dz=(a.z-e.z)/d;}
        else if(def.behavior==='leap') {e.state='jump';e.timer=.9;a.fromX=e.x;a.fromZ=e.z;}
        else {
          if(def.behavior==='spit') {if(sight&&pd<=def.attackRange) spit(s,e,def.damage);}
          else if(gap<=def.attackRange&&permitted&&(targetPlayer?sight&&!barrier:true)) damage(s,e.attack.barrierId?'barricade':e.target,def.damage*(targetPlayer||e.attack.barrierId?1:MOD[e.spiderId]),e.id,'contact',emit);
          e.state=def.behavior==='spit'?'spit':'attack';e.timer=.2;e.cooldown=def.attackCooldown;
        }
      } continue;
    }
    if(['attack','spit','land'].includes(e.state)) {e.timer-=DT;if(e.timer<=0)e.state='walk';continue;}
    if(!e.cooldown&&gap<=def.attackRange&&permitted&&(targetPlayer?sight&&(def.behavior==='leap'||def.behavior==='spit'||!barrier):true)) {
      e.state='windup';e.timer=def.behavior==='charge'?.8:.3;e.attack={x:target.x,z:target.z,hit:false,...(e.barrierId?{barrierId:e.barrierId}:{})};continue;
    }
    if(!permitted&&gap<3) {e.state='idle';continue;}
    e.state='walk';
    let speed=def.speed*(e.enraged?1.3:1)*(e.elite?1.2:1);
    if(def.behavior==='spit'&&pd<8) speed=-speed;
    else if(def.behavior==='spit'&&pd<=14&&sight) speed=0;
    if(e.route||gap>Math.min(def.attackRange*.65,1)||def.behavior==='spit') approach(e,target,speed,s);
    triggerTraps(s);
  }
  for(const web of s.webs) {
    const origin={x:web.x,y:web.y,z:web.z};
    web.life-=DT;web.x+=web.vx*DT;web.z+=web.vz*DT;
    const travel=Math.hypot(web.vx,web.vz)*DT;
    if(insideShelter(web.x,web.z,.25)||obstacleDistance(s,origin,{x:web.vx/12,y:0,z:web.vz/12},travel,.16)<=travel) web.life=0;
    else if(distance(web,s.player)<.6&&s.player.y<.75) {damage(s,'player',web.damage,web.source,'projectile',emit,{x:-web.vx,z:-web.vz});web.life=0;}
  }
  s.webs=s.webs.filter(w=>w.life>0);
}
