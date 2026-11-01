import { BARRICADE, BARRICADE_SITES } from '../data/barricades.js';
import { distance, visible } from './physics.js';
import { obstacleAt } from './obstacles.js';

export function barricadeOffer(s){
  const site=[...BARRICADE_SITES].sort((a,b)=>distance(s.player,a)-distance(s.player,b))[0];
  const b=s.barricades?.find(b=>b.id===site.id),repair=b?.health>0;
  const kind=repair?'repairBarricade':'buildBarricade',cost=repair?BARRICADE.repairCost:BARRICADE.cost,amount=repair?Math.min(BARRICADE.repairAmount,BARRICADE.health-b.health):BARRICADE.health;
  let reason='';
  if(s.phase!=='build'||s.subphase!=='build')reason='Баррикады доступны только в подготовке';
  else if(distance(s.player,site)>BARRICADE.reach)reason='Подойдите к площадке баррикады';
  else if(s.player.y>0||s.player.vy!==0)reason='Для постройки встаньте на землю';
  else if(!visible(s.player,{...site,y:0,height:1.1}))reason='Обойдите шалаш к площадке';
  else if(!repair&&obstacleAt({barricades:[{...site,health:1}]},s.player.x,s.player.z,.35,0))reason='Отойдите от линии досок';
  else if(!repair&&(s.traps??[]).some(t=>Math.abs(t.x-site.x)<site.halfX+.8&&Math.abs(t.z-site.z)<site.halfZ+.8))reason='Площадка занята капканом';
  else if(!amount)reason='Баррикада цела';
  else if(s.scrap<cost)reason='Недостаточно деталей';
  return {kind,cost,amount,ok:!reason,reason,site};
}

export function interactBarricade(s){
  const o=barricadeOffer(s);s.lastAction={...o,tick:s.tick};if(!o.ok)return;
  s.scrap-=o.cost;if(s.stats)s.stats.scrapSpent+=o.cost;
  s.barricades??=[];let b=s.barricades.find(b=>b.id===o.site.id);
  if(!b){b={...o.site,health:0,maxHealth:BARRICADE.health};s.barricades.push(b);}
  b.health=Math.min(BARRICADE.health,b.health+o.amount);
}

export function damageBarricade(s,b,amount){
  if(!b||b.health<=0||!Number.isFinite(amount)||amount<=0)return 0;
  const applied=Math.min(b.health,amount);b.health-=applied;b.hitTime=s.time??0;
  if(b.health===0)s.barricadeNotice={time:s.time,id:b.id,label:b.label,text:`Баррикада ${b.label.toLowerCase()} разрушена`};
  return applied;
}
