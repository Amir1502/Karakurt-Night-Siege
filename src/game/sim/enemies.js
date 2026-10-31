import { DT, clamp, distance, visible, move, insideShelter } from './physics.js';
const MOD = {karakurt_runner:.2,karakurt_spitter:0,tarantula_brute:.4,jumper_wolf:0,widow_queen:.25};
function damage(s, target, amount, source, kind, emit) {
  if(amount<=0) return;
  if(target==='player') {
    if(kind==='contact'&&s.player.contactSafe>0) return;
    const applied=Math.min(s.player.health,amount);s.player.health-=applied;
    if(kind==='contact') s.player.contactSafe=.35;
    emit('player:damage',{amount:applied,health:s.player.health,source,kind});
  } else {
    const applied=Math.min(s.shelterIntegrity,amount);s.shelterIntegrity-=applied;
    emit('shelter:damage',{amount:applied,shelterIntegrity:s.shelterIntegrity,source,kind});
  }
}
function spit(s,e,amount) {
  const dx=s.player.x-e.x,dz=s.player.z-e.z,d=Math.hypot(dx,dz)||1;
  s.webs.push({id:`${e.id}:${s.tick}`,x:e.x,y:.7,z:e.z,vx:dx/d*12,vz:dz/d*12,life:5,damage:amount,source:e.id});
}
function approach(e,target,speed) {
  const dx=target.x-e.x,dz=target.z-e.z,d=Math.hypot(dx,dz)||1;
  e.yaw=Math.atan2(dx,dz);
  const moved=move(e,dx/d*speed*DT,dz/d*speed*DT,e.radius,40);
  // Slide around the solid shelter instead of tunnelling through it.
  if(moved<speed*DT*.1 && d>1) move(e,-dz/d*speed*DT,dx/d*speed*DT,e.radius,40);
}
export function updateEnemies(s,config,emit) {
  const slots=new Map();
  for(const e of s.spiders) {
    if(e.health<=0) continue;
    const def=config.spiders.find(d=>d.id===e.spiderId), p=s.player;
    e.cooldown=Math.max(0,e.cooldown-DT);e.aggro=Math.max(0,e.aggro-DT);e.spitCooldown-=DT;
    e.enraged=e.enraged||(def.behavior==='boss'&&e.health<=e.maxHealth*.5);
    const pd=distance(e,p)-e.radius-.35, sight=visible(e,p);
    let targetPlayer=def.behavior==='spit'||def.behavior==='leap'||(def.behavior==='chase'&&(e.aggro>0||pd<=10&&sight))||(def.behavior==='boss'&&pd<=15&&sight);
    if(def.behavior==='charge'&&pd<3&&sight) targetPlayer=true;
    e.target=targetPlayer?'player':'shelter';
    const side=Math.abs(e.x/3)>Math.abs(e.z/2.5)?(e.x>0?0:1):(e.z>0?2:3);
    const used=slots.get(side)||0, cost=def.behavior==='boss'?2:1;
    const wallTarget=side<2?{x:(side===0?1:-1)*(3+e.radius),z:used===0?-1.2:1.2}:{x:used===0?-1.5:1.5,z:(side===2?1:-1)*(2.5+e.radius)};
    const target=targetPlayer?p:wallTarget;
    const gap=targetPlayer?pd:distance(e,wallTarget);
    const permitted=targetPlayer||used+cost<=2;
    if(!targetPlayer&&gap<3&&permitted) slots.set(side,used+cost);
    if(def.behavior==='boss'&&e.spitCooldown<=0&&sight) {spit(s,e,16);e.spitCooldown=e.enraged?4:6;}
    if(e.state==='jump') {
      e.timer-=DT; const t=clamp(1-e.timer/.9,0,1);
      const nx=e.attack.fromX+(e.attack.x-e.attack.fromX)*t,nz=e.attack.fromZ+(e.attack.z-e.attack.fromZ)*t;
      move(e,nx-e.x,nz-e.z,e.radius,40);e.y=4*t*(1-t)*1.8;
      if(e.timer<=0) {e.y=0;e.state='land';e.timer=.15;e.cooldown=def.attackCooldown;
        if(distance(e,p)<=1.2&&visible(e,p)) damage(s,'player',def.damage,e.id,'contact',emit);}
      continue;
    }
    if(e.state==='charge') {
      e.timer-=DT;move(e,e.attack.dx*def.speed*2.5*DT,e.attack.dz*def.speed*2.5*DT,e.radius,40);
      if(!e.attack.hit) {
        if(distance(e,p)-e.radius-.35<=def.attackRange&&visible(e,p)) {damage(s,'player',def.damage,e.id,'contact',emit);e.attack.hit=true;}
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
          else if(gap<=def.attackRange&&permitted&&(targetPlayer?sight:true)) damage(s,e.target,def.damage*(targetPlayer?1:MOD[e.spiderId]),e.id,'contact',emit);
          e.state=def.behavior==='spit'?'spit':'attack';e.timer=.2;e.cooldown=def.attackCooldown;
        }
      } continue;
    }
    if(['attack','spit','land'].includes(e.state)) {e.timer-=DT;if(e.timer<=0)e.state='walk';continue;}
    if(!e.cooldown&&gap<=def.attackRange&&permitted&&(targetPlayer?sight:true)) {
      e.state='windup';e.timer=def.behavior==='charge'?.8:.3;e.attack={x:target.x,z:target.z,hit:false};continue;
    }
    if(!permitted&&gap<3) {e.state='idle';continue;}
    e.state='walk';
    let speed=def.speed*(e.enraged?1.3:1);
    if(def.behavior==='spit'&&pd<8) speed=-speed;
    else if(def.behavior==='spit'&&pd<=14&&sight) speed=0;
    if(gap>Math.min(def.attackRange*.65,1)||def.behavior==='spit') approach(e,target,speed);
  }
  for(const web of s.webs) {
    web.life-=DT;web.x+=web.vx*DT;web.z+=web.vz*DT;
    if(insideShelter(web.x,web.z,.25)) web.life=0;
    else if(distance(web,s.player)<.6&&s.player.y<.75) {damage(s,'player',web.damage,web.source,'projectile',emit);web.life=0;}
  }
  s.webs=s.webs.filter(w=>w.life>0);
}
